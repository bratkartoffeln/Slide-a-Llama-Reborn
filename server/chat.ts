import { CHAT_HISTORY_LIMIT, CHAT_MAX_LENGTH, CHAT_MIN_INTERVAL_MS, normalizeText, requestId, type ChatMessage } from '../shared/protocol.js';
import type { Seat } from '../shared/game.js';

/** Same invariants as RPS: room-local history, authenticated sender, idempotent retries. */
export class RoomChat {
  messages: ChatMessage[] = [];
  private nextId = 1;
  private lastSent: [number, number] = [-Infinity, -Infinity];
  accept(data: Record<string, unknown>, seat: Seat, name: string, now = Date.now()): void {
    if (!requestId(data.requestId)) throw new Error('Ungültige Nachrichtenkennung.');
    if (this.messages.some(m => m.seat === seat && m.requestId === data.requestId)) return;
    if (typeof data.text !== 'string') throw new Error('Schreibe eine Nachricht.');
    const text = normalizeText(data.text);
    if (!text || Array.from(text).length > CHAT_MAX_LENGTH) throw new Error('Nachrichten dürfen 1 bis 300 Zeichen enthalten.');
    if (now - this.lastSent[seat] < CHAT_MIN_INTERVAL_MS) throw new Error('Bitte warte kurz vor der nächsten Nachricht.');
    this.messages.push({ id: this.nextId++, requestId: data.requestId, seat, name, text, sentAt: now });
    if (this.messages.length > CHAT_HISTORY_LIMIT) this.messages.shift();
    this.lastSent[seat] = now;
  }
}
