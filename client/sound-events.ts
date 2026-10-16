import { findMatches, lamaCounts, type Game, type Seat, type Tile } from '../shared/game';

export const FEEDBACK_TIMING = { insert: 165, gravity: 105, burst: 180, fall: 105 } as const;
export type TurnSound = { delay: number } & (
  | { kind: 'move' | 'combo' }
  | { kind: 'match'; tile: Tile; length: number; multiplier: number }
  | { kind: 'voice'; mood: 'happy' | 'angry' }
);

/** Follow resolved matches, including cascades of a different tile to the one inserted. */
export function turnSounds(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number], you: Seat, animated = true): TurnSound[] {
  const start = animated ? FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity : 0;
  const step = FEEDBACK_TIMING.burst + FEEDBACK_TIMING.fall;
  const cues: TurnSound[] = [{ kind: 'move', delay: 0 }];
  for (const [index, frame] of last.frames.entries()) {
    const kinds = new Map<Tile, number>();
    for (const match of findMatches(frame.board)) kinds.set(match.tile, Math.max(kinds.get(match.tile) ?? 0, match.cells.length));
    let simultaneous = 0;
    for (const [tile, length] of kinds) cues.push({ kind: 'match', tile, length, multiplier: frame.multiplier, delay: start + index * step + simultaneous++ * 90 });
    if (index === 1) cues.push({ kind: 'combo', delay: start + index * step });
  }
  const delta = lamaCounts(after)[you] - lamaCounts(before)[you];
  if (delta !== 0) cues.push({ kind: 'voice', mood: delta > 0 ? 'happy' : 'angry', delay: start + last.frames.length * step + 100 });
  return cues.sort((a, b) => a.delay - b.delay);
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
