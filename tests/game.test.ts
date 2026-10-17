import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, push, insert, resolve, findMatches, play, lamaCounts, botMove, MOVES, randomTile, type Board } from '../shared/game.js';

const empty = (): Board => Array.from({ length: 5 }, () => Array(5).fill(null));
test('BAR is drawn, scores its original 100 points and supports length bonuses and transfers', () => {
  assert.equal(randomTile(() => .999), 'bar');
  for (const size of [3, 4, 5]) {
    const board = empty(); for (let col = 0; col < size; col++) board[4][col] = 'bar';
    const result = resolve(board); assert.equal(result.points, 100 * (size - 2));
    assert.equal(result.board.flat().filter(Boolean).length, 0);
  }
  const game = newGame(); game.board = empty(); game.board[4][0] = game.board[4][1] = 'bar'; game.queue[0] = 'bar';
  const next = play(game, 0, { side: 'left', lane: 4 });
  assert.equal(next.scores[0], 100); assert.deepEqual(lamaCounts(next.scores), [6, 4]);
});
test('Initial boards are full and contain no automatic matches, even with a constant RNG', () => {
  for (let i = 0; i < 100; i++) {
    const game = newGame(i < 2 ? () => i * .99 : Math.random);
    assert.equal(game.board.flat().filter(Boolean).length, 25);
    assert.deepEqual(findMatches(game.board), []);
    assert.equal(game.queue.length, 4);
  }
});
test('Top insertion falls through gaps and ejects the bottom stone of a full column', () => {
  const board = empty(); board[4][2] = 'seven';
  const result = insert(board, 'cherry', { side: 'top', lane: 2 });
  assert.equal(result[3][2], 'cherry'); assert.equal(result[4][2], 'seven');
  const full: Board = Array.from({ length: 5 }, () => ['cherry', 'lemon', 'grape', 'melon', 'seven']);
  const pushed = insert(full, 'bell', { side: 'top', lane: 0 });
  assert.deepEqual(pushed.map(r => r[0]), ['bell', 'cherry', 'cherry', 'cherry', 'cherry']);
  assert.equal(full[0][0], 'cherry');
});
test('Side insertion shifts the row in both directions and gravity settles stones', () => {
  const board = empty(); board[4] = ['cherry', 'lemon', 'grape', 'melon', 'seven'];
  assert.deepEqual(insert(board, 'bell', { side: 'left', lane: 4 })[4], ['bell', 'cherry', 'lemon', 'grape', 'melon']);
  assert.deepEqual(insert(board, 'bell', { side: 'right', lane: 4 })[4], ['lemon', 'grape', 'melon', 'seven', 'bell']);
  const fallen = insert(empty(), 'bell', { side: 'left', lane: 0 });
  assert.equal(fallen[4][0], 'bell'); assert.equal(fallen.flat().filter(Boolean).length, 1);
});
test('Side pushes stop at the first gap and never move disconnected stones', () => {
  const board = empty();
  board[4] = ['cherry', 'lemon', null, 'melon', 'seven'];
  assert.deepEqual(insert(board, 'bell', { side: 'left', lane: 4 })[4], ['bell', 'cherry', 'lemon', 'melon', 'seven']);
  assert.deepEqual(insert(board, 'bell', { side: 'right', lane: 4 })[4], ['cherry', 'lemon', 'melon', 'seven', 'bell']);
  board[4] = [null, 'lemon', null, 'melon', null];
  assert.deepEqual(insert(board, 'bell', { side: 'left', lane: 4 })[4], ['bell', 'lemon', null, 'melon', null]);
  assert.deepEqual(insert(board, 'bell', { side: 'right', lane: 4 })[4], [null, 'lemon', null, 'melon', 'bell']);
  assert.deepEqual(board[4], [null, 'lemon', null, 'melon', null]);
});
test('Top pushing also stops at the first gap before gravity settles the column', () => {
  const board = empty();
  const column = ['cherry', 'lemon', null, 'melon', 'seven'] as const;
  column.forEach((tile, row) => { board[row][2] = tile; });
  assert.deepEqual(push(board, 'bell', { side: 'top', lane: 2 }).map(row => row[2]), ['bell', 'cherry', 'lemon', 'melon', 'seven']);
  board[0][2] = null;
  assert.deepEqual(push(board, 'bell', { side: 'top', lane: 2 }).map(row => row[2]), ['bell', 'lemon', null, 'melon', 'seven']);
  assert.deepEqual(insert(board, 'bell', { side: 'top', lane: 2 }).map(row => row[2]), [null, 'bell', 'lemon', 'melon', 'seven']);
});
test('Three, four and five in a line score once with ×1, ×2 and ×3 length bonuses', () => {
  for (const size of [3, 4, 5]) {
    const board = empty(); for (let c = 0; c < size; c++) board[4][c] = 'lemon';
    const result = resolve(board); assert.equal(result.points, 20 * (size - 2));
    assert.equal(result.board.flat().filter(Boolean).length, 0);
    assert.equal(result.frames.length, 1);
  }
});
test('Gravity creates a second cascade and doubles its points without a random refill', () => {
  const board = empty();
  board[4] = ['cherry', 'cherry', 'cherry', 'lemon', 'lemon'];
  board[3][2] = 'lemon';
  const result = resolve(board);
  assert.equal(result.points, 10 + 20 * 2); assert.equal(result.frames.length, 2);
  assert.equal(result.board.flat().filter(Boolean).length, 0);
});
test('Cross matches pay both lines while removing intersecting cells only once', () => {
  const board = empty(); board[2][2] = board[3][2] = board[4][2] = 'bell';
  board[4][1] = board[4][3] = 'bell';
  const result = resolve(board); assert.equal(result.points, 100);
  assert.equal(result.frames[0].matches.length, 5); assert.equal(result.board.flat().filter(Boolean).length, 0);
});
test('Authoritative turn validation, queue progression, immutable state and victory', () => {
  const game = newGame(() => .1); const before = JSON.stringify(game);
  assert.throws(() => play(game, 1, MOVES[0]), /nicht am Zug/);
  assert.throws(() => play(game, 0, { side: 'top', lane: 99 }), /ungültig/);
  const next = play(game, 0, MOVES[0], () => .9);
  assert.equal(next.turn, 1); assert.equal(next.revision, 1); assert.equal(JSON.stringify(game), before);
  assert.equal(next.queue[0], game.queue[1]);
  game.board = empty(); game.board[4][1] = game.board[4][2] = 'cherry';
  game.queue[0] = 'cherry'; game.scores = [290, 0];
  const win = play(game, 0, { side: 'top', lane: 0 });
  assert.equal(win.winner, 0); assert.deepEqual(lamaCounts(win.scores), [10, 0]);
  assert.throws(() => play(win, 1, MOVES[0]), /beendet/);
});
test('Lama transfer is symmetric at exactly sixty-point boundaries', () => {
  assert.deepEqual(lamaCounts([59, 0]), [5, 5]); assert.deepEqual(lamaCounts([60, 0]), [6, 4]);
  assert.deepEqual(lamaCounts([0, 59]), [5, 5]); assert.deepEqual(lamaCounts([0, 60]), [4, 6]);
  assert.deepEqual(lamaCounts([0, 350]), [0, 10]);
});
test('Bot chooses legal moves and long games preserve gravity and terminate cascades', () => {
  let game = newGame();
  for (let i = 0; i < 150 && game.winner === null; i++) {
    const choice = botMove(game); assert.ok(MOVES.some(m => m.side === choice.side && m.lane === choice.lane));
    game = play(game, game.turn, choice);
    assert.equal(findMatches(game.board).length, 0);
    for (let c = 0; c < 5; c++) { let seen = false; for (let r = 0; r < 5; r++) { if (game.board[r][c]) seen = true; else assert.equal(seen, false); } }
  }
});

test('CPU levels make different tactical choices and hard avoids a loss beyond the direct reply', () => {
  const game = newGame();
  game.board = [
    ['seven', 'cherry', 'melon', 'melon', 'cherry'],
    ['cherry', 'grape', 'grape', 'melon', 'grape'],
    ['bell', 'lemon', 'cherry', 'cherry', 'bar'],
    ['bell', 'lemon', 'cherry', 'bell', 'seven'],
    ['cherry', 'melon', 'grape', 'seven', 'bar']
  ];
  game.queue = ['grape', 'seven', 'grape', 'grape'];
  const before = JSON.stringify(game);
  assert.deepEqual(botMove(game, 'easy'), { side: 'top', lane: 0 });
  assert.deepEqual(botMove(game, 'medium'), { side: 'left', lane: 2 });
  assert.deepEqual(botMove(game, 'hard'), { side: 'right', lane: 0 });
  // Exhaust every remaining reply rather than relying on the production search pruning.
  function finalLead(position: typeof game, remaining: number): number {
    if (position.winner !== null) return position.winner === 0 ? 100000 : -100000;
    if (!remaining) return position.scores[0] - position.scores[1];
    const leads = MOVES.map(move => finalLead(play(position, position.turn, move, () => .5), remaining - 1));
    return position.turn === 0 ? Math.max(...leads) : Math.min(...leads);
  }
  assert.equal(finalLead(play(game, 0, botMove(game, 'medium'), () => .5), 3), -30);
  assert.equal(finalLead(play(game, 0, botMove(game, 'hard'), () => .5), 3), 0);
  assert.equal(JSON.stringify(game), before);
});

test('Every CPU level takes an immediate winning move for either seat', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) for (const seat of [0, 1] as const) {
    const game = newGame(); game.turn = seat; game.scores[seat] = 290;
    game.board = empty(); game.board[4][1] = game.board[4][2] = 'cherry'; game.queue[0] = 'cherry';
    assert.equal(play(game, seat, botMove(game, difficulty)).winner, seat);
  }
});
