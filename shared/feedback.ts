import { lamaCounts, type Board, type Game, type Move } from './game.js';

// One timeline for animation, sound and the server's next-turn gate.
export const FEEDBACK_TIMING = { crack: 420, crush: 360, insert: 330, gravity: 210, burst: 360, fall: 210, comboDelay: 900, comboHold: 1800, transfer: 1900 } as const;
export function crushesBottom(board: Board | undefined, move: Move): boolean {
  return move.side === 'top' && !!board && board.every(row => row[move.lane] !== null);
}
export function crushMotionMs(board: Board | undefined, move: Move): number {
  return crushesBottom(board, move) ? FEEDBACK_TIMING.crack + FEEDBACK_TIMING.crush : 0;
}
export function boardMotionMs(last: NonNullable<Game['lastMove']>, previous?: Board): number {
  return crushMotionMs(previous, last.move) + FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity + last.frames.reduce((duration, frame) => duration + FEEDBACK_TIMING.burst + FEEDBACK_TIMING.fall + (frame.multiplier > 1 ? FEEDBACK_TIMING.comboHold : 0), 0);
}
export function turnMotionMs(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number], previous?: Board): number {
  return boardMotionMs(last, previous) + (lamaCounts(before)[0] !== lamaCounts(after)[0] ? FEEDBACK_TIMING.transfer : 0);
}
