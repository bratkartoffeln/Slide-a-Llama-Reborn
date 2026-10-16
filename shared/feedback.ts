import { cloneBoard, findMatches, lamaCounts, push, type Board, type Frame, type Game, type Move } from './game.js';

export function comboFactor(frame: Frame): number {
  return Math.max(frame.multiplier, findMatches(frame.board).length);
}

// One timeline for animation, sound and the server's next-turn gate.
export const FEEDBACK_TIMING = { crack: 420, crush: 360, insert: 330, gravity: 210, matchBlink: 1200, matchTitle: 1000, burst: 360, fall: 210, ejectTip: 240, ejectFall: 780, comboDelay: 900, comboHold: 1800, transfer: 1900 } as const;
/** Constant gravity in cell units: t ∝ sqrt(distance), followed by a short landing. */
export function gravityPlan(board: Board) {
  const moves: { row: number; target: number; col: number; cells: number; flight: number; duration: number }[] = [];
  for (let col = 0; col < 5; col++) {
    let target = 4;
    for (let row = 4; row >= 0; row--) if (board[row][col]) {
      if (row !== target) {
        const cells = target - row, flight = Math.round(320 * Math.sqrt(cells));
        moves.push({ row, target, col, cells, flight, duration: flight + 120 });
      }
      target--;
    }
  }
  return moves;
}
export function gravityMotionMs(board: Board): number { return Math.max(0, ...gravityPlan(board).map(move => move.duration)); }
export function gravityImpactMs(board: Board): number { return Math.max(0, ...gravityPlan(board).map(move => move.flight)); }
export function initialGravityMs(last: NonNullable<Game['lastMove']>, previous?: Board): number {
  return Math.max(FEEDBACK_TIMING.gravity, previous && last.move.side !== 'top' ? gravityMotionMs(push(previous, last.tile, last.move)) : 0);
}
export function clearedFrame(frame: Frame): Board {
  const board = cloneBoard(frame.board);
  for (const [row, col] of frame.matches) board[row][col] = null;
  return board;
}
export function frameFallMs(frame: Frame): number { return Math.max(FEEDBACK_TIMING.fall, gravityMotionMs(clearedFrame(frame))); }
/** Both clients and the server derive the same bounded variation from the resolved hit. */
export function burstPlan(frame: Frame) {
  let seed = 2166136261;
  for (const char of JSON.stringify([frame.board, frame.points, frame.multiplier])) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const sequential = frame.matches.length > 1 && seed % 2 === 0, scattered = (seed >>> 4) % 4 === 0;
  const delays = new Map<string, number>();
  if (sequential) for (const line of findMatches(frame.board)) {
    const cells = (seed >>> 1) & 1 ? [...line.cells].reverse() : line.cells;
    cells.forEach((cell, index) => { const key = cell.join(':'); delays.set(key, Math.min(delays.get(key) ?? Infinity, index * 180)); });
  }
  const cells = frame.matches.map(([row, col]) => ({ row, col, delay: delays.get(`${row}:${col}`) ?? 0 }));
  const tail = Math.max(0, ...cells.map(cell => cell.delay));
  // Gravity waits for the last stone to break, while debris and dust keep moving independently.
  return { seed, sequential, scattered, cells, duration: FEEDBACK_TIMING.burst + tail };
}
export function comboDelayMs(frame: Frame): number {
  return Math.max(FEEDBACK_TIMING.comboDelay, burstPlan(frame).duration + frameFallMs(frame) + 330);
}
export function sideEjectImpactMs(board: Board | undefined, move: Move): number {
  return move.side !== 'top' && board?.[move.lane].every(tile => tile !== null) ? FEEDBACK_TIMING.insert + FEEDBACK_TIMING.ejectTip + FEEDBACK_TIMING.ejectFall : 0;
}
export function crushesBottom(board: Board | undefined, move: Move): boolean {
  return move.side === 'top' && !!board && board.every(row => row[move.lane] !== null);
}
export function crushMotionMs(board: Board | undefined, move: Move): number {
  return crushesBottom(board, move) ? FEEDBACK_TIMING.crack + FEEDBACK_TIMING.crush : 0;
}
export function boardMotionMs(last: NonNullable<Game['lastMove']>, previous?: Board): number {
  const board = crushMotionMs(previous, last.move) + FEEDBACK_TIMING.insert + initialGravityMs(last, previous) + last.frames.reduce((duration, frame) => duration + FEEDBACK_TIMING.matchBlink + FEEDBACK_TIMING.matchTitle + burstPlan(frame).duration + frameFallMs(frame) + (comboFactor(frame) > 1 ? FEEDBACK_TIMING.comboHold : 0), 0);
  const impact = sideEjectImpactMs(previous, last.move);
  return Math.max(board, impact ? impact + FEEDBACK_TIMING.burst : 0);
}
export function turnMotionMs(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number], previous?: Board): number {
  return boardMotionMs(last, previous) + (lamaCounts(before)[0] !== lamaCounts(after)[0] ? FEEDBACK_TIMING.transfer : 0);
}
