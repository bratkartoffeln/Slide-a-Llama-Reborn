import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { newGame, play, botMove, validMove, type Game, type Seat, type Move } from '../shared/game.js';
import { normalizeText, requestId, type Phase, type ServerMessage, type Snapshot } from '../shared/protocol.js';
import { RoomChat } from './chat.js';
import { DeploymentGuard } from './deploy-guard.js';
import { turnMotionMs } from '../shared/feedback.js';

const random = () => randomInt(0, 0x100000000) / 0x100000000;
interface Player { name: string; token: string; socket: WebSocket | null; bot: boolean; rematch: boolean; reconnectUntil: number | null }
interface Room {
  aim: Move | null;
  code: string; players: [Player | null, Player | null]; game: Game; chat: RoomChat;
  phase: Phase; deadline: number | null; remaining: number; availableAt: number;
  botAt: number; turnSeconds: number; round: number; wins: [number, number]; endReason: string | null; touched: number;
}
export interface ServerOptions { port?: number; host?: string; staticDir?: string; reconnectMs?: number; turnMs?: number; animationMs?: number; botDelayMs?: number; allowedOrigins?: string[]; random?: () => number }
export async function startServer(options: ServerOptions = {}) {
  const rooms = new Map<string, Room>();
  const connections = new Map<WebSocket, { room?: Room; seat?: Seat; alive: boolean; count: number; window: number; joined: number }>();
  const ipRates = new Map<string, { count: number; since: number }>();
  const reconnectMs = options.reconnectMs ?? 120_000;
  const gameRandom = options.random ?? random;
  const root = resolve(options.staticDir ?? 'dist/client');
  const version = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }).version;
  let ready = true;
  const deployment = new DeploymentGuard(() => rooms.size);
  const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };
  const http = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (deployment.handle(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (pathname === '/ready' || pathname === '/health') {
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ready, version, rooms: rooms.size })); return;
    }
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep) || pathname.includes('\0') || pathname.split('/').some(p => p.startsWith('.'))) { res.writeHead(403); res.end(); return; }
    try {
      if (!(await stat(path)).isFile()) throw new Error();
      const content = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Datei nicht gefunden. Zuerst npm run build ausführen.'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const send = (ws: WebSocket | null, message: ServerMessage) => {
    if (ws?.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 256_000) { ws.terminate(); return; }
      ws.send(JSON.stringify(message));
    }
  };
  function snapshot(room: Room, seat: Seat): Snapshot {
    return { room: room.code, you: seat, game: room.game, players: room.players.map(p => p ? ({ name: p.name, connected: p.bot || p.socket?.readyState === WebSocket.OPEN, bot: p.bot, rematch: p.rematch, reconnectUntil: p.reconnectUntil }) : null) as Snapshot['players'],
      phase: room.phase, deadline: room.deadline, availableAt: room.availableAt, serverTime: Date.now(), turnSeconds: room.turnSeconds, round: room.round, wins: room.wins, endReason: room.endReason };
  }
  function broadcast(room: Room) { room.players.forEach((p, seat) => { if (p) send(p.socket, { type: 'snapshot', state: snapshot(room, seat as Seat) }); }); }
  function chat(room: Room) { room.players.forEach(p => { if (p) send(p.socket, { type: 'chat', messages: room.chat.messages }); }); }
  function duration(room: Room) { return options.turnMs ?? room.turnSeconds * 1000; }
  function connected(room: Room) { return room.players.every(p => p && (p.bot || p.socket?.readyState === WebSocket.OPEN)); }
  function finish(room: Room, winner: Seat, reason: string) {
    if (room.phase === 'finished') return;
    room.game = { ...room.game, winner, lastMove: room.game.winner === null ? null : room.game.lastMove, revision: room.game.revision + 1 };
    room.phase = 'finished'; room.deadline = null; room.endReason = reason; room.wins[winner]++;
    room.touched = Date.now(); broadcast(room);
  }
  function start(room: Room) {
    room.phase = 'playing'; room.deadline = Date.now() + duration(room); room.botAt = Date.now() + (options.botDelayMs ?? 1100);
    room.endReason = null; room.availableAt = Date.now(); broadcast(room);
  }
  function move(room: Room, seat: Seat, input: Move, automatic = false) {
    if (room.phase !== 'playing' || !connected(room)) throw new Error('Warte, bis beide Spieler verbunden sind.');
    if (Date.now() < room.availableAt) throw new Error('Die Steine bewegen sich noch.');
    const beforeScores = room.game.scores;
    const previousBoard = room.game.board;
    room.game = play(room.game, seat, input, gameRandom, automatic);
    room.aim = null;
    room.touched = Date.now();
    room.availableAt = Date.now() + (options.animationMs !== undefined ? Math.max(1, room.game.lastMove!.frames.length) * options.animationMs : turnMotionMs(room.game.lastMove!, beforeScores, room.game.scores, previousBoard));
    if (room.game.winner !== null) { finish(room, room.game.winner, 'Alle zehn Lamas sind überzeugt!'); return; }
    room.deadline = room.availableAt + duration(room);
    room.botAt = room.availableAt + (options.botDelayMs ?? 1100); broadcast(room);
  }
  function player(name: unknown, socket: WebSocket | null, bot = false): Player {
    const text = typeof name === 'string' ? normalizeText(name) : '';
    if (!bot && (!text || Array.from(text).length > 20)) throw new Error('Wähle einen Namen mit 1 bis 20 Zeichen.');
    return { name: bot ? 'Paco' : text, token: randomBytes(32).toString('hex'), socket, bot, rematch: false, reconnectUntil: null };
  }
  function attach(ws: WebSocket, room: Room, seat: Seat) {
    const p = room.players[seat]!;
    const old = p.socket;
    p.socket = ws; p.reconnectUntil = null;
    Object.assign(connections.get(ws)!, { room, seat });
    if (old && old !== ws) { send(old, { type: 'error', message: 'Dein Platz wurde in einem anderen Fenster geöffnet.', terminal: true }); old.close(4001); }
    room.touched = Date.now();
    send(ws, { type: 'welcome', room: room.code, token: p.token, seat });
    if (room.phase === 'waiting' && room.players[1]) {
      if (connected(room)) start(room);
      else { room.phase = 'paused'; room.remaining = duration(room); broadcast(room); }
    }
    else if (room.phase === 'paused' && connected(room)) {
      room.phase = 'playing'; room.deadline = Date.now() + Math.max(1000, room.remaining); room.botAt = Date.now() + (options.botDelayMs ?? 1100); broadcast(room);
    } else broadcast(room);
    send(ws, { type: 'chat', messages: room.chat.messages });
  }
  function detach(ws: WebSocket, leave = false) {
    const ctx = connections.get(ws);
    if (!ctx?.room || ctx.seat === undefined) return;
    const room = ctx.room, p = room.players[ctx.seat]!;
    if (p.socket !== ws) return;
    p.socket = null; p.reconnectUntil = Date.now() + (leave ? 0 : reconnectMs);
    if (leave) p.token = '';
    if (room.phase === 'playing') {
      room.remaining = Math.max(1000, (room.deadline ?? Date.now()) - Date.now());
      room.phase = 'paused'; room.deadline = null;
    }
    if (leave && room.phase !== 'finished' && room.players[1]) finish(room, ctx.seat === 0 ? 1 : 0, `${p.name} hat den Raum verlassen.`);
    broadcast(room);
  }
  http.on('upgrade', (req, socket, head) => {
    const reject = (status: number) => { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`); };
    if (!ready || deployment.active || req.url !== '/ws' || connections.size >= 1000) { reject(503); return; }
    const origin = req.headers.origin;
    try {
      if (options.allowedOrigins?.length ? !origin || !options.allowedOrigins.includes(origin) : origin && new URL(origin).host !== req.headers.host) { reject(403); return; }
    } catch { reject(403); return; }
    const ip = req.socket.remoteAddress ?? 'unknown', now = Date.now();
    let rate = ipRates.get(ip);
    if (!rate || now - rate.since > 60_000) { rate = { count: 0, since: now }; ipRates.set(ip, rate); }
    if (++rate.count > 60) { reject(429); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  wss.on('connection', ws => {
    connections.set(ws, { alive: true, count: 0, window: Date.now(), joined: Date.now() });
    ws.on('error', () => {});
    ws.on('pong', () => { const ctx = connections.get(ws); if (ctx) ctx.alive = true; });
    ws.on('message', (raw, binary) => {
      const ctx = connections.get(ws)!;
      if (Date.now() - ctx.window > 1000) { ctx.window = Date.now(); ctx.count = 0; }
      if (++ctx.count > 40) { ws.close(4008, 'Too many messages'); return; }
      let data: Record<string, unknown> = {};
      try {
        if (binary) throw new Error('Nur Textnachrichten sind erlaubt.');
        const value: unknown = JSON.parse(raw.toString());
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige Nachricht.');
        data = value as Record<string, unknown>;
        if (deployment.active) throw new Error('Ein Update wird installiert. Bitte gleich erneut versuchen.');
        if (!ctx.room) {
          if (data.type === 'create') {
            if (rooms.size >= 200) throw new Error('Alle Spieltische sind belegt. Versuche es später erneut.');
            const p = player(data.name, ws);
            let code: string; do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
            const turnSeconds = data.turnSeconds === 15 || data.turnSeconds === 60 ? data.turnSeconds : 30;
            const room: Room = { aim: null, code, players: [p, data.bot === true ? player('', null, true) : null], game: newGame(gameRandom), chat: new RoomChat(), phase: 'waiting', deadline: null, remaining: 0, availableAt: 0, botAt: 0, turnSeconds, round: 1, wins: [0, 0], endReason: null, touched: Date.now() };
            rooms.set(code, room); attach(ws, room, 0); return;
          }
          const code = typeof data.room === 'string' ? data.room.trim().toUpperCase() : '';
          const room = rooms.get(code);
          if (!room) { send(ws, { type: 'error', message: 'Dieser Raum ist nicht mehr verfügbar. Erstelle ein neues Duell.', terminal: data.type === 'resume' }); return; }
          if (data.type === 'join') {
            if (room.players[1] || room.phase !== 'waiting') throw new Error('Dieser Raum ist bereits belegt.');
            room.players[1] = player(data.name, ws); attach(ws, room, 1); return;
          }
          if (data.type === 'resume') {
            const seat = room.players.findIndex(p => p && !p.bot && p.token && p.token === data.token && (p.reconnectUntil === null || p.reconnectUntil > Date.now()));
            if (seat < 0) { send(ws, { type: 'error', message: 'Deine Wiederverbindungszeit ist abgelaufen.', terminal: true }); return; }
            attach(ws, room, seat as Seat); return;
          }
          throw new Error('Erstelle einen Raum oder tritt einem Raum bei.');
        }
        const room = ctx.room, seat = ctx.seat!, p = room.players[seat]!;
        if (p.socket !== ws) throw new Error('Diese Verbindung ist nicht mehr aktiv.');
        if (data.type === 'sync') { send(ws, { type: 'snapshot', state: snapshot(room, seat) }); send(ws, { type: 'chat', messages: room.chat.messages }); }
        else if (data.type === 'aim') {
          if (!validMove(data.move)) throw new Error('Ungültiger Einschub.');
          if (room.phase === 'playing' && seat === room.game.turn && data.revision === room.game.revision && Date.now() >= room.availableAt && room.deadline && Date.now() < room.deadline) room.aim = { ...data.move };
        }
        else if (data.type === 'move') {
          if (data.revision !== room.game.revision) throw new Error('Der Spielstand hat sich geändert. Versuche den Zug erneut.');
          if (!validMove(data.move)) throw new Error('Ungültiger Einschub.');
          move(room, seat, data.move);
        } else if (data.type === 'chat') { room.chat.accept(data, seat, p.name); chat(room); }
        else if (data.type === 'leave') { detach(ws, true); ws.close(1000); }
        else if (data.type === 'resign') {
          if (room.phase !== 'playing' && room.phase !== 'paused') throw new Error('Es läuft gerade keine Partie.');
          finish(room, seat === 0 ? 1 : 0, `${p.name} hat aufgegeben.`);
        } else if (data.type === 'rematch') {
          if (room.phase !== 'finished' || !connected(room)) throw new Error('Für eine Revanche müssen beide Spieler verbunden sein.');
          p.rematch = true;
          if (room.players[1]?.bot) room.players[1].rematch = true;
          if (room.players.every(p => p?.rematch)) {
            room.round++;
            room.aim = null;
            room.game = newGame(gameRandom, (room.round % 2 === 0 ? 1 : 0), room.game.revision + 1);
            room.players.forEach(p => { if (p) p.rematch = false; }); start(room);
          } else broadcast(room);
        } else throw new Error('Unbekannte Aktion.');
      } catch (error) {
        send(ws, { type: 'error', message: error instanceof SyntaxError ? 'Ungültiges Nachrichtenformat.' : error instanceof Error ? error.message : 'Aktion fehlgeschlagen.', requestId: requestId(data.requestId) ? data.requestId : undefined });
      }
    });
    ws.on('close', () => { detach(ws); connections.delete(ws); });
  });
  const tick = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const seat of [0, 1] as const) {
        const p = room.players[seat];
        if (p && !p.bot && p.reconnectUntil !== null && now >= p.reconnectUntil) {
          p.reconnectUntil = null; p.token = '';
          if (room.phase === 'paused') finish(room, seat === 0 ? 1 : 0, `${p.name} ist nicht zurückgekehrt.`);
        }
      }
      // Bots do not keep abandoned rooms alive. Retain each human's reconnect
      // window, including one that started after another player's expired.
      if (room.players.every(p => !p || p.bot || (p.socket === null && p.reconnectUntil === null))) {
        rooms.delete(room.code);
        continue;
      }
      if (room.phase === 'playing' && connected(room) && now >= room.availableAt) {
        if (room.players[room.game.turn]?.bot && now >= room.botAt) move(room, room.game.turn, botMove(room.game));
        else if (room.deadline && now >= room.deadline) move(room, room.game.turn, room.aim ?? { side: 'top', lane: 0 }, true);
      }
      if (now - room.touched > 30 * 60_000 && (room.phase === 'waiting' || room.phase === 'finished')) {
        rooms.delete(room.code);
        room.players.forEach(p => { if (p?.socket) { send(p.socket, { type: 'error', message: 'Dieser Raum wurde nach 30 Minuten Inaktivität geschlossen.', terminal: true }); p.socket.close(4000); } });
      }
    }
    for (const [ws, ctx] of connections) if (!ctx.room && now - ctx.joined > 15_000) ws.close(4000);
  }, 100);
  const heartbeat = setInterval(() => {
    for (const [ws, ctx] of connections) { if (!ctx.alive) ws.terminate(); else { ctx.alive = false; ws.ping(); } }
    for (const [ip, rate] of ipRates) if (Date.now() - rate.since > 60_000) ipRates.delete(ip);
  }, 10_000);
  await new Promise<void>((yes, no) => { http.once('error', no); http.listen(options.port ?? 2568, options.host ?? '0.0.0.0', () => { http.off('error', no); yes(); }); });
  const address = http.address() as { port: number };
  let closed = false;
  return {
    port: address.port, url: `http://127.0.0.1:${address.port}`, rooms,
    async close() {
      if (closed) return; closed = true; ready = false; clearInterval(tick); clearInterval(heartbeat);
      for (const ws of connections.keys()) { send(ws, { type: 'shutdown', message: 'Der Spielserver wird neu gestartet. Bitte starte danach eine neue Partie.' }); ws.close(1012); }
      // Prevent a server shutdown from counting as a resignation.
      rooms.clear(); connections.forEach(ctx => { ctx.room = undefined; });
      const timer = setTimeout(() => { for (const ws of wss.clients) ws.terminate(); }, 200);
      await new Promise<void>(yes => wss.close(() => yes())); clearTimeout(timer);
      await new Promise<void>(yes => http.close(() => yes()));
    }
  };
}
