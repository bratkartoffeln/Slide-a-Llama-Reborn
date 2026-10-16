import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
export async function checkOnline(url) {
  const health = await fetch(new URL('/ready', url), { signal: AbortSignal.timeout(5000) });
  assert.equal(health.status, 200); assert.equal((await health.json()).ready, true);
  const html = await fetch(url); assert.equal(html.status, 200); assert.match(await html.text(), /Slide-a-Lama/);
  const clients = [];
  async function connect() {
    const endpoint = new URL('/ws', url); endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(endpoint, { origin: new URL(url).origin }); clients.push(socket);
    const messages = []; socket.on('message', raw => messages.push(JSON.parse(raw.toString())));
    await new Promise((yes, no) => { socket.once('open', yes); socket.once('error', no); });
    return { socket, send: data => socket.send(JSON.stringify(data)), wait: async predicate => {
      const until = Date.now() + 5000;
      while (Date.now() < until) { const found = messages.find(predicate); if (found) return found; await new Promise(r => setTimeout(r, 20)); }
      throw new Error('Multiplayer-Smoke-Test: Antwort fehlt.');
    } };
  }
  try {
    const a = await connect(); a.send({ type: 'create', name: 'Smoke A' }); const welcome = await a.wait(m => m.type === 'welcome');
    const b = await connect(); b.send({ type: 'join', room: welcome.room, name: 'Smoke B' }); await b.wait(m => m.type === 'welcome');
    await a.wait(m => m.type === 'snapshot' && m.state.phase === 'playing');
    a.send({ type: 'move', revision: 0, move: { side: 'top', lane: 0 } });
    const moved = await b.wait(m => m.type === 'snapshot' && m.state.game.revision === 1); assert.equal(moved.state.game.turn, 1);
    a.send({ type: 'chat', requestId: 'smoke', text: 'Hallo aus dem Produktionsimage' }); await b.wait(m => m.type === 'chat' && m.messages.length === 1);
    a.socket.terminate(); await b.wait(m => m.type === 'snapshot' && m.state.phase === 'paused');
    const resumed = await connect(); resumed.send({ type: 'resume', room: welcome.room, token: welcome.token });
    await resumed.wait(m => m.type === 'welcome'); await resumed.wait(m => m.type === 'snapshot' && m.state.phase === 'playing');
    resumed.send({ type: 'leave' }); b.send({ type: 'leave' });
    console.log('Produktionsprüfung bestanden: HTTP, zwei Spieler, Zug, Chat und Wiederverbindung.');
  } finally { clients.forEach(ws => ws.terminate()); }
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/check-online.mjs')) await checkOnline(process.argv[2] ?? 'http://127.0.0.1:2568');
