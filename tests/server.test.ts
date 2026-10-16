import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { startServer as createServer, type ServerOptions } from '../server/app.js';
import type { ServerMessage, Snapshot } from '../shared/protocol.js';
function startServer(options: ServerOptions = {}) {
  let seed = 42;
  return createServer({ ...options, random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; } });
}

async function client(url: string) {
  const ws = new WebSocket(url.replace('http:', 'ws:') + '/ws');
  const messages: ServerMessage[] = [];
  ws.on('message', raw => messages.push(JSON.parse(raw.toString()) as ServerMessage));
  await new Promise<void>((yes, no) => { ws.once('open', yes); ws.once('error', no); });
  return {
    ws, messages, send(data: object) { ws.send(JSON.stringify(data)); },
    async wait<T extends ServerMessage['type']>(type: T, predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true, from = 0): Promise<Extract<ServerMessage, { type: T }>> {
      const end = Date.now() + 4000;
      while (Date.now() < end) {
        const found = messages.slice(from).find(m => m.type === type && predicate(m as Extract<ServerMessage, { type: T }>));
        if (found) return found as Extract<ServerMessage, { type: T }>;
        await new Promise(r => setTimeout(r, 10));
      }
      throw new Error(`Timeout waiting for ${type}; received ${JSON.stringify(messages)}`);
    }
  };
}
async function pair(url: string) {
  const a = await client(url); a.send({ type: 'create', name: 'Alex' }); const welcome = await a.wait('welcome');
  const b = await client(url); b.send({ type: 'join', room: welcome.room, name: 'Sam' }); await b.wait('welcome');
  const s = (await a.wait('snapshot', m => m.state.phase === 'playing')).state;
  return { a, b, welcome, s };
}
test('Two real sockets share state, reject a third player and reject wrong/stale moves', async t => {
  const server = await startServer({ port: 0, animationMs: 0 }); t.after(() => server.close());
  const { a, b, welcome, s } = await pair(server.url);
  assert.equal(s.players[0]?.name, 'Alex'); assert.equal(s.players[1]?.name, 'Sam');
  assert.ok(!JSON.stringify(s).includes(welcome.token));
  const c = await client(server.url); c.send({ type: 'join', room: welcome.room, name: 'Eve' }); await c.wait('error', m => m.message.includes('belegt'));
  b.send({ type: 'move', revision: 0, move: { side: 'top', lane: 0 } }); await b.wait('error', m => m.message.includes('nicht am Zug'));
  a.send({ type: 'move', revision: 0, move: { side: 'top', lane: 2 } });
  const first = await a.wait('snapshot', m => m.state.game.revision === 1);
  const second = await b.wait('snapshot', m => m.state.game.revision === 1);
  assert.deepEqual(first.state.game, second.state.game);
  b.send({ type: 'move', revision: 0, move: { side: 'top', lane: 1 } }); await b.wait('error', m => m.message.includes('geändert'));
  b.send({ type: 'move', revision: 1, move: { side: 'right', lane: 2 } }); await a.wait('snapshot', m => m.state.game.revision === 2);
});
test('Chat is private to the room, authenticates authors and accepts idempotent retries', async t => {
  const server = await startServer({ port: 0 }); t.after(() => server.close());
  const { a, b } = await pair(server.url);
  const outsider = await client(server.url); outsider.send({ type: 'create', name: 'Elsewhere' }); await outsider.wait('welcome');
  a.send({ type: 'chat', requestId: 'hello', text: '<img src=x onerror=alert(1)> 🦙', name: 'Forged', seat: 1 });
  const history = await b.wait('chat', m => m.messages.length === 1);
  assert.equal(history.messages[0].name, 'Alex'); assert.equal(history.messages[0].seat, 0);
  a.send({ type: 'chat', requestId: 'hello', text: 'again' });
  await new Promise(r => setTimeout(r, 30));
  assert.equal((a.messages.filter(m => m.type === 'chat').at(-1) as { type: 'chat'; messages: unknown[] }).messages.length, 1);
  assert.ok(!JSON.stringify(outsider.messages).includes('onerror'));
});
test('Drop pauses the clock; the secret session resumes the same player, board and chat', async t => {
  const server = await startServer({ port: 0, reconnectMs: 2000 }); t.after(() => server.close());
  const { a, b, welcome, s } = await pair(server.url);
  a.send({ type: 'chat', requestId: 'saved', text: 'Bis gleich' }); await b.wait('chat', m => m.messages.length === 1);
  a.ws.terminate(); await b.wait('snapshot', m => m.state.phase === 'paused');
  const resumed = await client(server.url); resumed.send({ type: 'resume', room: welcome.room, token: welcome.token });
  await resumed.wait('welcome');
  const next = (await resumed.wait('snapshot', m => m.state.phase === 'playing')).state;
  assert.equal(next.you, 0); assert.deepEqual(next.game, s.game);
  await resumed.wait('chat', m => m.messages[0]?.text === 'Bis gleich');
  const bad = await client(server.url); bad.send({ type: 'resume', room: welcome.room, token: 'not-a-token' });
  await bad.wait('error', m => m.terminal === true);
});
test('Joining while the host reconnects keeps the match paused and resumes correctly', async t => {
  const server = await startServer({ port: 0, reconnectMs: 2000 }); t.after(() => server.close());
  const a = await client(server.url); a.send({ type: 'create', name: 'Alex' }); const w = await a.wait('welcome');
  a.ws.terminate(); await new Promise(r => setTimeout(r, 25));
  const b = await client(server.url); b.send({ type: 'join', room: w.room, name: 'Sam' }); await b.wait('snapshot', m => m.state.phase === 'paused');
  const resumed = await client(server.url); resumed.send({ type: 'resume', room: w.room, token: w.token });
  await resumed.wait('snapshot', m => m.state.phase === 'playing');
});
test('Expired reconnection ends the game, without allowing a stranger to take the seat', async t => {
  const server = await startServer({ port: 0, reconnectMs: 120 }); t.after(() => server.close());
  const { a, b, welcome } = await pair(server.url); a.ws.terminate();
  const end = (await b.wait('snapshot', m => m.state.phase === 'finished')).state;
  assert.equal(end.game.winner, 1); assert.deepEqual(end.wins, [0, 1]);
  assert.equal((await (await fetch(server.url + '/ready')).json()).rooms, 1);
  const stranger = await client(server.url); stranger.send({ type: 'resume', room: welcome.room, token: welcome.token }); await stranger.wait('error', m => !!m.terminal);
});
test('Server clock inserts a tile after timeout and practice bot takes its own turns', async t => {
  const server = await startServer({ port: 0, turnMs: 120, animationMs: 0, botDelayMs: 20 }); t.after(() => server.close());
  const a = await client(server.url); a.send({ type: 'create', name: 'Alex', bot: true });
  await a.wait('snapshot', m => m.state.game.lastMove?.automatic === true);
  await a.wait('snapshot', m => m.state.game.revision >= 2 && m.state.game.turn === 0);
});
test('Resignation and mutual rematch track wins, alternate starters and invalidate old revisions', async t => {
  const server = await startServer({ port: 0 }); t.after(() => server.close());
  const { a, b } = await pair(server.url); a.send({ type: 'resign' });
  const end = (await b.wait('snapshot', m => m.state.phase === 'finished')).state;
  assert.equal(end.game.winner, 1);
  a.send({ type: 'rematch' }); await b.wait('snapshot', m => m.state.players[0]?.rematch === true);
  b.send({ type: 'rematch' }); const next = (await a.wait('snapshot', m => m.state.round === 2)).state;
  assert.equal(next.phase, 'playing'); assert.equal(next.game.turn, 1); assert.deepEqual(next.game.scores, [0, 0]); assert.deepEqual(next.wins, [0, 1]);
  assert.ok(next.game.revision > end.game.revision);
});
test('Health exposes version only; origin checks and shutdown signaling work', async t => {
  const server = await startServer({ port: 0 }); t.after(() => server.close());
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const health = await fetch(server.url + '/ready'); assert.equal(health.status, 200); assert.equal((await health.json()).version, version);
  const bad = new WebSocket(server.url.replace('http:', 'ws:') + '/ws', { origin: 'https://evil.invalid' });
  const rejected = await new Promise<number>(yes => { bad.on('unexpected-response', (_req, res) => { res.resume(); yes(res.statusCode!); bad.terminate(); }); bad.on('error', () => {}); });
  assert.equal(rejected, 403);
  const { a, b } = await pair(server.url);
  await server.close(); await a.wait('shutdown'); await b.wait('shutdown');
  assert.ok(!a.messages.some(m => m.type === 'snapshot' && m.state.phase === 'finished'));
});

for (const mode of ['waiting', 'playing', 'finished', 'bot'] as const) {
  test('Abandoned ' + mode + ' room expires after reconnect grace and unblocks deployment', async t => {
    const server = await startServer({ port: 0, reconnectMs: 500 });
    t.after(() => server.close());
    let players: Awaited<ReturnType<typeof client>>[];
    if (mode === 'playing' || mode === 'finished') {
      const { a, b } = await pair(server.url);
      players = [a, b];
      if (mode === 'finished') {
        a.send({ type: 'resign' });
        await b.wait('snapshot', m => m.state.phase === 'finished');
      }
    } else {
      const a = await client(server.url);
      a.send({ type: 'create', name: 'Alex', bot: mode === 'bot' });
      await a.wait('welcome');
      players = [a];
    }
    for (const p of players) p.ws.terminate();
    // The reconnect window still blocks deployment before cleanup.
    assert.equal((await (await fetch(server.url + '/ready')).json()).rooms, 1);
    assert.equal((await fetch(server.url + '/internal/maintenance/enter', { method: 'POST' })).status, 409);
    const deadline = Date.now() + 3000;
    while ((await (await fetch(server.url + '/ready')).json()).rooms !== 0) {
      assert.ok(Date.now() < deadline, 'Abandoned room should expire without the 30-minute idle timeout');
      await new Promise(r => setTimeout(r, 20));
    }
    assert.equal((await fetch(server.url + '/internal/maintenance/enter', { method: 'POST' })).status, 200);
  });
}

test('The last disconnected human retains their full reconnect window after the other expires', async t => {
  const server = await startServer({ port: 0, reconnectMs: 500 });
  t.after(() => server.close());
  const { a, b, welcome } = await pair(server.url);
  const secondWelcome = await b.wait('welcome');
  a.ws.terminate();
  await b.wait('snapshot', m => m.state.phase === 'finished');
  b.ws.terminate();
  assert.equal((await (await fetch(server.url + '/ready')).json()).rooms, 1);
  const resumed = await client(server.url);
  resumed.send({ type: 'resume', room: welcome.room, token: secondWelcome.token });
  await resumed.wait('welcome');
  assert.equal((await (await fetch(server.url + '/ready')).json()).rooms, 1);
});
