export const SIZE = 5;
export const LAMA_STEP = 60;
export const WIN_LEAD = 300;
export const TILES = ['cherry', 'lemon', 'grape', 'melon', 'bell', 'seven'] as const;
export type Tile = typeof TILES[number];
export const TILE_INFO: Record<Tile, { name: string; points: number; color: string }> = {
  cherry: { name: 'Kirsche', points: 10, color: '#d9544c' },
  lemon: { name: 'Zitrone', points: 20, color: '#e7ba36' },
  grape: { name: 'Traube', points: 30, color: '#9873b5' },
  melon: { name: 'Melone', points: 40, color: '#6c9f7a' },
  bell: { name: 'Glocke', points: 50, color: '#ce9439' },
  seven: { name: 'Sieben', points: 60, color: '#d85d42' }
};
export type Cell = Tile | null;
export type Board = Cell[][];
export type Seat = 0 | 1;
export type Move = { side: 'top' | 'left' | 'right'; lane: number };
export type Match = { tile: Tile; cells: [number, number][] };
export type Frame = { board: Board; matches: [number, number][]; points: number; multiplier: number };
export interface Game {
  board: Board; queue: Tile[]; scores: [number, number]; turn: Seat;
  revision: number; winner: Seat | null; lastMove: null | {
    seat: Seat; move: Move; tile: Tile; points: number; frames: Frame[]; automatic: boolean;
  };
}
export const cloneBoard = (board: Board): Board => board.map(row => [...row]);
export function randomTile(random = Math.random): Tile {
  // Common fruit offers steady matches; bells and sevens are rarer.
  const bag: Tile[] = ['cherry', 'cherry', 'cherry', 'lemon', 'lemon', 'lemon', 'grape', 'grape', 'melon', 'melon', 'bell', 'seven'];
  return bag[Math.min(bag.length - 1, Math.floor(random() * bag.length))];
}
export function newGame(random = Math.random, turn: Seat = 0, revision = 0): Game {
  const board: Board = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const forbidden = new Set<Cell>();
    if (c > 1 && board[r][c - 1] === board[r][c - 2]) forbidden.add(board[r][c - 1]);
    if (r > 1 && board[r - 1][c] === board[r - 2][c]) forbidden.add(board[r - 1][c]);
    let tile = randomTile(random);
    if (forbidden.has(tile)) tile = TILES.find(t => !forbidden.has(t))!;
    board[r][c] = tile;
  }
  return { board, queue: Array.from({ length: 4 }, () => randomTile(random)), scores: [0, 0], turn, revision, winner: null, lastMove: null };
}
export function validMove(value: unknown): value is Move {
  if (!value || typeof value !== 'object') return false;
  const m = value as Move;
  return ['top', 'left', 'right'].includes(m.side) && Number.isInteger(m.lane) && m.lane >= 0 && m.lane < SIZE;
}
export function gravity(board: Board): void {
  for (let c = 0; c < SIZE; c++) {
    const values = board.map(row => row[c]).filter((v): v is Tile => v !== null);
    for (let r = SIZE - 1; r >= 0; r--) board[r][c] = values.pop() ?? null;
  }
}
export function findMatches(board: Board): Match[] {
  const matches: Match[] = [];
  for (const vertical of [false, true]) for (let lane = 0; lane < SIZE; lane++) {
    let start = 0;
    while (start < SIZE) {
      const at = (i: number) => vertical ? board[i][lane] : board[lane][i];
      const tile = at(start);
      let end = start + 1;
      while (end < SIZE && at(end) === tile) end++;
      if (tile && end - start >= 3) matches.push({ tile, cells: Array.from({ length: end - start }, (_, i) => vertical ? [start + i, lane] : [lane, start + i]) });
      start = end;
    }
  }
  return matches;
}
/** Apply contact-only pushing before gravity, also used by the client animation. */
export function push(board: Board, tile: Tile, move: Move): Board {
  const next = cloneBoard(board);
  if (move.side === 'top') {
    const empty = next.findIndex(row => row[move.lane] === null);
    const gap = empty < 0 ? SIZE - 1 : empty;
    for (let r = gap; r > 0; r--) next[r][move.lane] = next[r - 1][move.lane];
    next[0][move.lane] = tile;
  } else {
    const row = next[move.lane];
    const from = move.side === 'left' ? 0 : SIZE - 1;
    const step = move.side === 'left' ? 1 : -1;
    let gap = from;
    while (gap >= 0 && gap < SIZE && row[gap] !== null) gap += step;
    // Only the touching chain moves. Pieces beyond the first gap stay put.
    if (gap < 0 || gap >= SIZE) gap = from + step * (SIZE - 1);
    for (let c = gap; c !== from; c -= step) row[c] = row[c - step];
    row[from] = tile;
  }
  return next;
}
export function insert(board: Board, tile: Tile, move: Move): Board {
  const next = push(board, tile, move);
  gravity(next);
  return next;
}
export function resolve(board: Board): { board: Board; frames: Frame[]; points: number } {
  const next = cloneBoard(board);
  const frames: Frame[] = [];
  let total = 0;
  // No refill: every cascade removes cells, so resolution always terminates.
  for (let multiplier = 1; ; multiplier++) {
    const matches = findMatches(next);
    if (!matches.length) break;
    const points = matches.reduce((sum, match) => sum + TILE_INFO[match.tile].points * (match.cells.length - 2) * multiplier, 0);
    const cells = [...new Map(matches.flatMap(m => m.cells).map(cell => [cell.join(','), cell])).values()];
    frames.push({ board: cloneBoard(next), matches: cells, points, multiplier });
    total += points;
    for (const [r, c] of cells) next[r][c] = null;
    gravity(next);
  }
  return { board: next, frames, points: total };
}
export function play(game: Game, seat: Seat, move: Move, random = Math.random, automatic = false): Game {
  if (game.winner !== null) throw new Error('Diese Partie ist beendet.');
  if (game.turn !== seat) throw new Error('Du bist noch nicht am Zug.');
  if (!validMove(move)) throw new Error('Dieser Einschub ist ungültig.');
  const tile = game.queue[0];
  const result = resolve(insert(game.board, tile, move));
  const scores: [number, number] = [...game.scores]; scores[seat] += result.points;
  const lead = scores[0] - scores[1];
  return { board: result.board, queue: [...game.queue.slice(1), randomTile(random)], scores,
    turn: seat === 0 ? 1 : 0, revision: game.revision + 1,
    winner: Math.abs(lead) >= WIN_LEAD ? (lead > 0 ? 0 : 1) : null,
    lastMove: { seat, move, tile, points: result.points, frames: result.frames, automatic } };
}
export function lamaCounts(scores: [number, number]): [number, number] {
  const diff = scores[0] - scores[1];
  const offset = Math.sign(diff) * Math.floor(Math.abs(diff) / LAMA_STEP);
  const left = Math.max(0, Math.min(10, 5 + offset));
  return [left, 10 - left];
}
export const MOVES: Move[] = (['top', 'left', 'right'] as const).flatMap(side => Array.from({ length: SIZE }, (_, lane) => ({ side, lane })));
export function botMove(game: Game): Move {
  // Both players see the same queue. Penalise the opponent's best reply.
  let best = MOVES[0], value = -Infinity;
  for (const move of MOVES) {
    const result = play(game, game.turn, move, () => 0.5);
    const gain = result.lastMove!.points;
    const reply = result.winner !== null ? 0 : Math.max(...MOVES.map(m => resolve(insert(result.board, result.queue[0], m)).points));
    const score = result.winner !== null ? 10000 : gain - reply * 0.75;
    if (score > value) { value = score; best = move; }
  }
  return best;
}
