import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomChat } from '../server/chat.js';
test('Chat deduplicates retries per player before rate checks and keeps authenticated names', () => {
  const chat = new RoomChat();
  chat.accept({ requestId: 'one', text: 'Hallo\n  Welt', name: 'Fake', seat: 1 }, 0, 'Alex', 0);
  chat.accept({ requestId: 'one', text: 'changed' }, 0, 'Alex', 1);
  assert.equal(chat.messages.length, 1); assert.equal(chat.messages[0].text, 'Hallo Welt'); assert.equal(chat.messages[0].name, 'Alex');
  chat.accept({ requestId: 'one', text: 'Guten Tag' }, 1, 'Sam', 1); assert.equal(chat.messages.length, 2);
  assert.throws(() => chat.accept({ requestId: 'two', text: 'Spam' }, 0, 'Alex', 20), /warte/);
});
test('Chat validates Unicode length, rejects malformed requests and bounds history', () => {
  const chat = new RoomChat();
  for (const invalid of [{ text: 'A' }, { requestId: 'x', text: {} }, { requestId: 'x', text: '\n' }, { requestId: 'x', text: '🦙'.repeat(301) }]) assert.throws(() => chat.accept(invalid, 0, 'Alex'));
  chat.accept({ requestId: 'unicode', text: '🦙'.repeat(300) }, 0, 'Alex', 0);
  for (let i = 1; i <= 55; i++) chat.accept({ requestId: `m${i}`, text: `Nachricht ${i}` }, 0, 'Alex', i * 500);
  assert.equal(chat.messages.length, 50); assert.equal(chat.messages.at(-1)?.text, 'Nachricht 55');
});
