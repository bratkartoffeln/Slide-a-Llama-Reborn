import { lamaCounts, type Game } from './game.js';

// One timeline for animation, sound and the server's next-turn gate.
export const FEEDBACK_TIMING = { insert: 330, gravity: 210, burst: 360, fall: 210, transfer: 1900 } as const;
export function boardMotionMs(last: NonNullable<Game['lastMove']>): number {
  return FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity + last.frames.length * (FEEDBACK_TIMING.burst + FEEDBACK_TIMING.fall);
}
export function turnMotionMs(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number]): number {
  return boardMotionMs(last) + (lamaCounts(before)[0] !== lamaCounts(after)[0] ? FEEDBACK_TIMING.transfer : 0);
}
