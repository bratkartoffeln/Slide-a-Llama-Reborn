import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnSounds, SoundVariants } from '../client/sound-events';
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
  for (const you of [0, 1] as const) {
    const voice = turnSounds(last, [50, 0], [60, 0], you).find(c => c.kind === 'voice');
    assert.equal(voice?.kind === 'voice' && voice.mood, you === 0 ? 'happy' : 'angry');
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
test('All 56 catalogued original files are present and distinct; silent scheduling still follows cascades', () => {
  assert.equal(ORIGINAL_SOUND_FILES.length, 56); assert.equal(new Set(ORIGINAL_SOUND_FILES).size, 56);
  for (const file of ORIGINAL_SOUND_FILES) assert.ok(readFileSync(new URL('../public' + file, import.meta.url)).length > 500, file);
  const game = newGame(); game.board = empty(); game.board[4][1] = game.board[4][2] = 'bell'; game.queue[0] = 'bell';
  const next = play(game, 0, { side: 'top', lane: 0 });
  assert.equal(turnSounds(next.lastMove!, game.scores, next.scores, 0, false).find(c => c.kind === 'match')?.delay, 0);
});
