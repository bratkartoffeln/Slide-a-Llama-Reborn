import { cloneBoard, findMatches, lamaCounts, push, type Board, type Game, type Seat, type Tile } from '../shared/game';
import { FEEDBACK_TIMING, boardMotionMs, crushMotionMs, sideEjectImpactMs } from '../shared/feedback';
export { FEEDBACK_TIMING } from '../shared/feedback';
import type { STONE_SOUNDS } from './audio-catalog';

export type TurnSound = { delay: number } & (
  | { kind: 'thunder' }
  | { kind: 'combo' }
  | { kind: 'stone'; action: keyof typeof STONE_SOUNDS }
  | { kind: 'match'; tile: Tile; length: number; multiplier: number }
  | { kind: 'voice'; mood: 'happy' | 'angry' }
);

/** Follow resolved matches, including cascades of a different tile to the one inserted. */
export function turnSounds(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number], you: Seat, animated = true, previous?: Board): TurnSound[] {
  const lead = crushMotionMs(previous, last.move);
  const start = animated ? lead + FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity : 0;
  const step = FEEDBACK_TIMING.burst + FEEDBACK_TIMING.fall;
  const cues: TurnSound[] = last.move.side === 'top' ? [] : [{ kind: 'stone', action: 'slide', delay: 0 }];
  const at = (time: number) => animated ? time : 0;
  if (previous) {
    const { side, lane } = last.move;
    const full = side === 'top' ? previous.every(row => row[lane] !== null) : previous[lane].every(cell => cell !== null);
    if (full) {
      if (side === 'top') cues.push({ kind: 'stone', action: 'squeeze', delay: 0 });
      const impact = sideEjectImpactMs(previous, last.move);
      cues.push({ kind: 'stone', action: 'burst', delay: at(side === 'top' ? FEEDBACK_TIMING.crack : impact) });
      if (impact) cues.push({ kind: 'stone', action: 'drop', delay: at(impact) });
    }
    if (side === 'top' || hasFallingStones(push(previous, last.tile, last.move))) cues.push({ kind: 'stone', action: 'drop', delay: at(lead + FEEDBACK_TIMING.insert + (side === 'top' && full ? 0 : FEEDBACK_TIMING.gravity)) });
  }
  let frameAt = start;
  for (const frame of last.frames) {
    cues.push({ kind: 'thunder', delay: frameAt });
    const titleAt = frameAt + (animated ? FEEDBACK_TIMING.matchBlink : 0);
    const burstAt = titleAt + (animated ? FEEDBACK_TIMING.matchTitle : 0);
    cues.push({ kind: 'stone', action: 'shatter', delay: burstAt });
    cues.push({ kind: 'stone', action: 'settle', delay: burstAt + FEEDBACK_TIMING.burst });
    const kinds = new Map<Tile, number>();
    for (const match of findMatches(frame.board)) kinds.set(match.tile, Math.max(kinds.get(match.tile) ?? 0, match.cells.length));
    let simultaneous = 0;
    for (const [tile, length] of kinds) cues.push({ kind: 'match', tile, length, multiplier: frame.multiplier, delay: titleAt + simultaneous++ * 90 });
    if (frame.multiplier > 1) cues.push({ kind: 'combo', delay: burstAt + FEEDBACK_TIMING.comboDelay });
    const cleared = cloneBoard(frame.board);
    for (const [r, c] of frame.matches) cleared[r][c] = null;
    if (hasFallingStones(cleared)) cues.push({ kind: 'stone', action: 'drop', delay: burstAt + step });
    frameAt = burstAt + step + (frame.multiplier > 1 ? FEEDBACK_TIMING.comboHold : 0);
  }
  const delta = lamaCounts(after)[you] - lamaCounts(before)[you];
  if (delta !== 0) {
    const transferAt = animated ? boardMotionMs(last, previous) : last.frames.some(frame => frame.multiplier > 1) ? frameAt : 0;
    cues.push({ kind: 'voice', mood: delta > 0 ? 'happy' : 'angry', delay: transferAt });
  }
  const mechanical = new Set<string>();
  return cues.sort((a, b) => a.delay - b.delay).filter(cue => {
    if (cue.kind !== 'stone') return true;
    if (mechanical.has(cue.action)) return false;
    mechanical.add(cue.action); return true;
  });
}

export function hasFallingStones(board: Board): boolean {
  return board[0].some((_, col) => {
    let gap = false;
    for (let row = board.length - 1; row >= 0; row--) {
      if (board[row][col] === null) gap = true;
      else if (gap) return true;
    }
    return false;
  });
}

/** Shuffled bags preserve variation without repeating at bag boundaries. */
export class SoundVariants {
  private bags = new Map<string, string[]>();
  private previous = new Map<string, string>();
  constructor(private random = Math.random) {}
  next(key: string, files: readonly string[]): string {
    if (!files.length) throw new Error('Empty sound bank');
    let bag = this.bags.get(key);
    if (!bag?.length) {
      bag = [...files];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag.at(-1) === this.previous.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags.set(key, bag);
    }
    const file = bag.pop()!; this.previous.set(key, file); return file;
  }
}
