import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnSounds, SoundVariants, FEEDBACK_TIMING } from '../client/sound-events';
import { boardMotionMs, turnMotionMs } from '../shared/feedback';
import { MATCH_SOUNDS, ORIGINAL_SOUND_FILES } from '../client/audio-catalog';
import { newGame, play, type Board } from '../shared/game';

const empty = (): Board => Array.from({ length: 5 }, () => Array(5).fill(null));
test('Sounds follow the resolved symbols in every cascade instead of the inserted tile', () => {
  const game = newGame(); game.board = empty();
  game.board[4] = ['cherry', 'cherry', null, 'lemon', 'lemon']; game.board[3][2] = 'lemon';
  game.queue[0] = 'cherry';
  const next = play(game, 0, { side: 'left', lane: 4 });
  assert.equal(next.lastMove!.frames.length, 2);
  const cues = turnSounds(next.lastMove!, game.scores, next.scores, 0);
  assert.deepEqual(cues.filter(c => c.kind === 'match').map(c => [c.tile, c.multiplier]), [['cherry', 1], ['lemon', 2]]);
  assert.equal(cues.filter(c => c.kind === 'combo').length, 1);
  assert.ok(cues.filter(c => c.kind === 'match').every(c => c.delay >= 270));
});
test('Lama reactions depend on gaining or losing a follower, with no voice on unchanged teams', () => {
  const game = newGame(); const next = play(game, 0, { side: 'top', lane: 0 }); const last = next.lastMove!;
  for (const [before, after, gaining] of [
    [[50, 0], [60, 0], 0], [[0, 50], [0, 180], 1], [[120, 0], [120, 300], 1]
  ] as const) for (const you of [0, 1] as const) {
    const voices = turnSounds(last, [...before], [...after], you).filter(c => c.kind === 'voice');
    assert.equal(voices.length, 1);
    assert.equal(voices[0].mood, you === gaining ? 'happy' : 'angry');
    assert.equal(voices[0].delay, boardMotionMs(last));
  }
  assert.ok(!turnSounds(last, [0, 0], [20, 0], 0).some(c => c.kind === 'voice'));
});
test('Crossed lines of the same symbol use one matching sound and all sound banks rotate without repeats', () => {
  const random = new SoundVariants(() => 0);
  for (const [tile, files] of Object.entries(MATCH_SOUNDS)) {
    const first = Array.from({ length: files.length }, () => random.next(tile, files));
    assert.equal(new Set(first).size, files.length);
    assert.notEqual(random.next(tile, files), first.at(-1));
  }
  const game = newGame(); game.board = empty();
  game.board[4][1] = game.board[4][3] = game.board[3][2] = 'bell'; game.queue[0] = 'bell'; game.board[2][2] = 'bell';
  const next = play(game, 0, { side: 'top', lane: 2 });
  assert.equal(turnSounds(next.lastMove!, game.scores, next.scores, 0).filter(c => c.kind === 'match').length, 1);
});
test('All 61 catalogued original files are present and distinct; silent scheduling still follows cascades', () => {
  assert.equal(ORIGINAL_SOUND_FILES.length, 61); assert.equal(new Set(ORIGINAL_SOUND_FILES).size, 61);
  for (const file of ORIGINAL_SOUND_FILES) assert.ok(readFileSync(new URL('../public' + file, import.meta.url)).length > 500, file);
  const game = newGame(); game.board = empty(); game.board[4][1] = game.board[4][2] = 'bell'; game.queue[0] = 'bell';
  const next = play(game, 0, { side: 'top', lane: 0 });
  assert.equal(turnSounds(next.lastMove!, game.scores, next.scores, 0, false).find(c => c.kind === 'match')?.delay, 0);
});

test('Full columns crush only the bottom stone and use original squeeze and burst sounds', () => {
  const game = newGame(() => .25);
  const next = play(game, 0, { side: 'top', lane: 1 });
  const cues = turnSounds(next.lastMove!, game.scores, next.scores, 0, true, game.board);
  assert.ok(cues.some(c => c.kind === 'stone' && c.action === 'squeeze'));
  assert.ok(cues.some(c => c.kind === 'stone' && c.action === 'burst' && c.delay === FEEDBACK_TIMING.crack));
  assert.equal(next.board[4][1], game.board[3][1]);
  const gap = empty(); gap[4][0] = 'bell';
  const withGap = { ...game, board: gap }; const dropped = play(withGap, 0, { side: 'top', lane: 0 });
  const gapCues = turnSounds(dropped.lastMove!, game.scores, dropped.scores, 0, true, gap);
  assert.ok(!gapCues.some(c => c.kind === 'stone' && (c.action === 'squeeze' || c.action === 'burst')));
  assert.ok(gapCues.some(c => c.kind === 'stone' && c.action === 'drop' && c.delay === FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity));
});

test('Landing cues follow cracks and burst; repeated mechanical sounds are coalesced per turn', () => {
  const game = newGame(() => .25); const next = play(game, 0, { side: 'top', lane: 0 }); const last = next.lastMove!;
  const cues = turnSounds(last, game.scores, next.scores, 0, true, game.board);
  const stone = cues.filter(cue => cue.kind === 'stone');
  assert.equal(stone.find(c => c.action === 'drop')!.delay, FEEDBACK_TIMING.crack + FEEDBACK_TIMING.crush + FEEDBACK_TIMING.insert);
  assert.equal(new Set(stone.map(c => c.action)).size, stone.length);
  assert.equal(boardMotionMs(last, game.board) - boardMotionMs(last), FEEDBACK_TIMING.crack + FEEDBACK_TIMING.crush);
  const gap = empty(); gap[4][0] = 'bell';
  const free = { ...game, board: gap }; const fallen = play(free, 0, { side: 'top', lane: 0 });
  const freeCues = turnSounds(fallen.lastMove!, free.scores, fallen.scores, 0, true, gap);
  assert.ok(!freeCues.some(c => c.kind === 'stone' && c.delay === 0));
});

test('Server gate and original transfer sounds follow the slower stone and follower timeline', () => {
  const game = newGame(); const next = play(game, 0, { side: 'top', lane: 0 }); const last = next.lastMove!;
  assert.deepEqual([FEEDBACK_TIMING.insert, FEEDBACK_TIMING.gravity, FEEDBACK_TIMING.burst, FEEDBACK_TIMING.fall], [330, 210, 360, 210]);
  assert.equal(turnMotionMs(last, [0, 0], [60, 0]), boardMotionMs(last) + 1900);
  const cues = turnSounds(last, [0, 0], [60, 0], 0);
  assert.ok(!cues.some(c => c.kind === 'stone' && /transfer/.test(c.action)));
  assert.ok(cues.some(c => c.kind === 'voice' && c.mood === 'happy' && c.delay === boardMotionMs(last)));
});
