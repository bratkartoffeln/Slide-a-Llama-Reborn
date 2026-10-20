import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServer, sessionKey } from '../client/server-config';

test('Native endpoints require explicit HTTPS origins and sessions stay on their server', () => {
  assert.equal(normalizeServer(' https://spiel.example:9443/ '), 'https://spiel.example:9443');
  for (const bad of ['http://spiel.example', 'https://localhost', 'https://127.0.0.1', 'https://[::1]',
    'https://user:pass@spiel.example', 'https://@spiel.example', 'https://spiel.example/path',
    'https://spiel.example?room=1234', 'https://spiel.example#test', 'https://spiel.example\\evil', 'https://spiel.\nexample']) {
    assert.throws(() => normalizeServer(bad), Error, bad);
  }
  assert.notEqual(sessionKey('AABBCCDD', 'https://a.example', true), sessionKey('AABBCCDD', 'https://b.example', true));
  assert.equal(sessionKey('AABBCCDD', 'https://a.example', false), 'lama:session:AABBCCDD');
});
