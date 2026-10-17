import type { Game, Seat, BotDifficulty } from './game.js';
export type Phase = 'waiting' | 'playing' | 'paused' | 'finished';
export interface PublicPlayer { name: string; connected: boolean; bot: boolean; difficulty?: BotDifficulty; rematch: boolean; reconnectUntil: number | null }
export interface ChatMessage { id: number; requestId: string; seat: Seat; name: string; text: string; sentAt: number }
export interface Snapshot {
  room: string; you: Seat; players: [PublicPlayer | null, PublicPlayer | null]; game: Game;
  phase: Phase; deadline: number | null; availableAt: number; serverTime: number;
  turnSeconds: number; round: number; wins: [number, number]; endReason: string | null;
}
export type ServerMessage =
  | { type: 'welcome'; room: string; token: string; seat: Seat }
  | { type: 'snapshot'; state: Snapshot }
  | { type: 'chat'; messages: ChatMessage[] }
  | { type: 'error'; message: string; requestId?: string; terminal?: boolean }
  | { type: 'shutdown'; message: string };
export const CHAT_MAX_LENGTH = 300;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_MIN_INTERVAL_MS = 500;
export function normalizeText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/gu, ' ').trim();
}
export function requestId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value); }
