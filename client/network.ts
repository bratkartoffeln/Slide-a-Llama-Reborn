import type { ServerMessage } from '../shared/protocol.js';
import { serverEndpoint, sessionKey } from './server-config';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended';
type Session = { room: string; token: string };
function read(room: string): Session | null {
  try { const token = sessionStorage.getItem(sessionKey(room)); return token ? { room, token } : null; } catch { return null; }
}
export function roomCode(input: string): string {
  const s = input.trim();
  if (/^[a-f\d]{8}$/i.test(s)) return s.toUpperCase();
  try { const code = new URL(s).searchParams.get('room') ?? ''; return /^[a-f\d]{8}$/i.test(code) ? code.toUpperCase() : ''; } catch { return ''; }
}
export class Connection {
  private ws: WebSocket | null = null;
  private session: Session | null = null;
  private generation = 0;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private retryStarted = 0;
  private attempt = 0;
  private seat: 0 | 1 | null = null;
  private chatPending = new Map<string, { type: 'chat'; requestId: string; text: string }>();
  status: ConnectionStatus = 'idle';
  constructor(private onMessage: (m: ServerMessage) => void, private onStatus: (s: ConnectionStatus) => void) {}
  private setStatus(s: ConnectionStatus) { this.status = s; this.onStatus(s); }
  resume(room: string): boolean {
    const session = read(room); if (!session) return false;
    this.session = session; this.retryStarted = Date.now(); this.open({ type: 'resume', ...session }); return true;
  }
  connect(payload: Record<string, unknown>) { this.disconnect(false); this.open(payload); }
  private open(payload: Record<string, unknown>) {
    const generation = ++this.generation;
    clearTimeout(this.retry);
    this.setStatus(payload.type === 'resume' ? 'reconnecting' : 'connecting');
    const url = new URL('/ws', serverEndpoint()); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url); this.ws = ws;
    const timeout = setTimeout(() => { if (generation === this.generation && this.status !== 'connected') ws.close(); }, 10_000);
    ws.onopen = () => { if (generation === this.generation) ws.send(JSON.stringify(payload)); };
    ws.onmessage = event => {
      if (generation !== this.generation) return;
      let message: ServerMessage;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'welcome') {
        clearTimeout(timeout); this.session = { room: message.room, token: message.token }; this.seat = message.seat; this.attempt = 0; this.retryStarted = 0;
        try { sessionStorage.setItem(sessionKey(message.room), message.token); } catch { /* optional storage */ }
        this.setStatus('connected');
        for (const pending of this.chatPending.values()) ws.send(JSON.stringify(pending));
      }
      if (message.type === 'chat') for (const m of message.messages) if (m.seat === this.seat && m.requestId) this.chatPending.delete(m.requestId);
      if (message.type === 'error' && message.requestId) this.chatPending.delete(message.requestId);
      if (message.type === 'shutdown' || (message.type === 'error' && message.terminal)) {
        this.onMessage(message); this.disconnect(); this.setStatus('ended'); clearTimeout(timeout); return;
      }
      if (message.type === 'error' && this.status === 'connecting') { this.onMessage(message); this.disconnect(false); clearTimeout(timeout); return; }
      this.onMessage(message);
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (generation !== this.generation) return;
      if (!this.session) { this.setStatus('idle'); this.onMessage({ type: 'error', message: 'Der Spielserver ist nicht erreichbar. Bitte versuche es erneut.' }); return; }
      if (!this.retryStarted) this.retryStarted = Date.now();
      if (Date.now() - this.retryStarted > 125_000) { this.onMessage({ type: 'error', message: 'Wiederverbindung nicht möglich. Bitte starte ein neues Duell.', terminal: true }); this.disconnect(); this.setStatus('ended'); return; }
      this.setStatus('reconnecting');
      this.retry = setTimeout(() => { if (this.session) this.open({ type: 'resume', ...this.session }); }, Math.min(5000, 500 * 2 ** this.attempt++));
    };
    ws.onerror = () => {}; // onclose handles connection failures and retries.
  }
  send(payload: Record<string, unknown>): boolean {
    if (this.status !== 'connected' || this.ws?.readyState !== WebSocket.OPEN) return false;
    if (payload.type === 'chat') this.chatPending.set(String(payload.requestId), payload as { type: 'chat'; requestId: string; text: string });
    this.ws.send(JSON.stringify(payload)); return true;
  }
  disconnect(forget = true) {
    ++this.generation; clearTimeout(this.retry);
    if (forget && this.session) { try { sessionStorage.removeItem(sessionKey(this.session.room)); } catch {} }
    this.ws?.close(); this.ws = null; this.session = null; this.chatPending.clear(); this.setStatus('idle');
  }
  leave() { this.send({ type: 'leave' }); this.disconnect(); }
}
