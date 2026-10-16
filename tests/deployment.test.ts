import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { startServer } from '../server/app.js';
import { localDeploymentRequest } from '../server/deploy-guard.js';

test('Deployment lock blocks new rooms even on an already-open WebSocket; exit reopens play', async t => {
  const server = await startServer({ port: 0 }); t.after(() => server.close());
  const ws = new WebSocket(server.url.replace('http:', 'ws:') + '/ws');
  ws.on('error', () => {}); await once(ws, 'open');
  const entered = await fetch(server.url + '/internal/maintenance/enter', { method: 'POST' });
  assert.equal(entered.status, 200); assert.equal((await entered.json()).maintenance, true);
  const rejected = once(ws, 'message'); ws.send(JSON.stringify({ type: 'create', name: 'Update test' }));
  assert.equal(JSON.parse(String((await rejected)[0])).type, 'error');
  assert.equal((await (await fetch(server.url + '/ready')).json()).rooms, 0);
  const exited = await fetch(server.url + '/internal/maintenance/exit', { method: 'POST' });
  assert.equal(exited.status, 200);
  const welcome = once(ws, 'message'); ws.send(JSON.stringify({ type: 'create', name: 'Update test' }));
  assert.equal(JSON.parse(String((await welcome)[0])).type, 'welcome');
  const busy = await fetch(server.url + '/internal/maintenance/enter', { method: 'POST' });
  assert.equal(busy.status, 409); assert.equal((await busy.json()).maintenance, false);
});

test('Deployment control accepts only exact loopback peers', () => {
  for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(localDeploymentRequest(address), true);
  for (const address of [undefined, '192.168.1.5', '172.18.0.2', '127.0.0.1.evil', '::ffff:192.168.1.5']) assert.equal(localDeploymentRequest(address), false);
});
