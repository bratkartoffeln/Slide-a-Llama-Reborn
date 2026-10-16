import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { turnSounds, SoundVariants, FEEDBACK_TIMING } from '../client/sound-events';
import { burstPlan, comboDelayMs, comboFactor, boardMotionMs, turnMotionMs, sideEjectImpactMs, frameFallMs, gravityPlan, gravityMotionMs, gravityImpactMs } from '../shared/feedback';
import { MATCH_SOUNDS, ORIGINAL_SOUND_FILES } from '../client/audio-catalog';
import { newGame, play, resolve, TILES, type Board } from '../shared/game';

const empty = (): Board => Array.from({ length: 5 }, () => Array(5).fill(null));
test('Falling stones use constant acceleration, distance-dependent flight and a landing before turn release', () => {
  const board = empty(); board[3][0] = 'bell'; board[0][1] = 'lemon';
  const [short, long] = gravityPlan(board);
  assert.equal(short.cells, 1); assert.equal(long.cells, 4);
  assert.equal(short.flight, 320); assert.equal(long.flight, short.flight * 2);
  assert.equal(short.duration - short.flight, 120); assert.equal(long.duration - long.flight, 120);
  assert.equal(gravityMotionMs(board), 760); assert.equal(gravityImpactMs(board), 640);
  const game = newGame(); game.board = empty(); game.board[0][0] = 'bell'; game.queue[0] = 'cherry';
  const next = play(game, 0, { side: 'left', lane: 0 });
  const drop = turnSounds(next.lastMove!, game.scores, next.scores, 0, true, game.board).find(cue => cue.kind === 'stone' && cue.action === 'drop')!;
  assert.equal(drop.delay, FEEDBACK_TIMING.insert + 640);
  assert.equal(boardMotionMs(next.lastMove!, game.board), drop.delay + 120);
});
test('Two simultaneous rows trigger the Combo sound and hold even in the first cascade', () => {
  const board = empty(); board[4] = ['cherry', 'cherry', 'cherry', null, null]; board[3] = ['lemon', 'lemon', 'lemon', null, null];
  const frame = resolve(board).frames[0];
  assert.equal(frame.multiplier, 1); assert.equal(comboFactor(frame), 2);
  const game = newGame(), last = play(game, 0, { side: 'top', lane: 0 }).lastMove!; last.frames = [frame];
  const cues = turnSounds(last, [0, 0], [30, 0], 0);
  assert.equal(cues.filter(cue => cue.kind === 'combo').length, 1);
  assert.equal(boardMotionMs(last), FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity + FEEDBACK_TIMING.matchBlink + FEEDBACK_TIMING.matchTitle + burstPlan(frame).duration + FEEDBACK_TIMING.fall + FEEDBACK_TIMING.comboHold);
});
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

test('BAR matches select the four original fruit6 variants', () => {
  const game = newGame(); game.board = empty(); game.board[4][0] = game.board[4][1] = 'bar'; game.queue[0] = 'bar';
  const next = play(game, 0, { side: 'left', lane: 4 });
  assert.ok(turnSounds(next.lastMove!, game.scores, next.scores, 0).some(cue => cue.kind === 'match' && cue.tile === 'bar'));
  assert.deepEqual(MATCH_SOUNDS.bar, Array.from({ length: 4 }, (_, i) => `/audio/original/fruit6-${i}.mp3`));
});
test('Every recognized cascade gets one thunder before the title and burst, including repeated symbols', () => {
  const game = newGame(); game.board = empty();
  game.board[4] = ['cherry', 'cherry', null, 'lemon', 'lemon']; game.board[3][2] = 'lemon'; game.queue[0] = 'cherry';
  const last = play(game, 0, { side: 'left', lane: 4 }).lastMove!;
  const cues = turnSounds(last, game.scores, [last.points, 0], 0, true, game.board);
  const thunder = cues.filter(cue => cue.kind === 'thunder');
  const hits = cues.filter(cue => cue.kind === 'match');
  assert.equal(thunder.length, 2);
  assert.equal(hits[0].delay - thunder[0].delay, FEEDBACK_TIMING.matchBlink);
  assert.equal(hits[1].delay - thunder[1].delay, FEEDBACK_TIMING.matchBlink);
  assert.equal(cues.find(cue => cue.kind === 'stone' && cue.action === 'shatter')!.delay - thunder[0].delay, FEEDBACK_TIMING.matchBlink + FEEDBACK_TIMING.matchTitle);
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

test('Combo accents follow the hit, finish before the next cascade and postpone the transfer gate', () => {
  const game = newGame(); game.board = empty();
  game.board[4] = ['cherry', 'cherry', null, 'lemon', 'lemon']; game.board[3][2] = 'lemon'; game.queue[0] = 'cherry';
  const last = play(game, 0, { side: 'left', lane: 4 }).lastMove!;
  last.frames.push({ ...last.frames[1], multiplier: 3 });
  const steps = last.frames.reduce((sum, frame) => sum + FEEDBACK_TIMING.matchBlink + FEEDBACK_TIMING.matchTitle + burstPlan(frame).duration + frameFallMs(frame), 0);
  assert.equal(boardMotionMs(last), FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity + steps + 2 * FEEDBACK_TIMING.comboHold);
  for (const animated of [true, false]) {
    const cues = turnSounds(last, [50, 0], [80, 0], 0, animated);
    const combos = cues.filter(cue => cue.kind === 'combo');
    assert.equal(combos.length, 2);
    for (const [index, combo] of combos.entries()) {
      const hit = cues.find(cue => cue.kind === 'match' && cue.multiplier === index + 2)!;
      assert.equal(combo.delay - hit.delay, animated ? comboDelayMs(last.frames[index + 1]) + FEEDBACK_TIMING.matchTitle : FEEDBACK_TIMING.comboDelay);
      const following = index === 0 ? cues.find(cue => cue.kind === 'match' && cue.multiplier === 3)! : cues.find(cue => cue.kind === 'voice')!;
      assert.ok(following.delay >= combo.delay + 1430, 'Original combo sample must finish before the next cascade or transfer');
    }
  }
});
test('Burst variations are deterministic, stagger only along matching lines, and wait for the last blast', () => {
  const styles = new Set<string>();
  for (const tile of TILES) for (const length of [3, 4, 5]) {
    const board = empty(); for (let col = 0; col < length; col++) board[4][col] = tile;
    const frame = resolve(board).frames[0], plan = burstPlan(frame);
    assert.deepEqual(plan, burstPlan(JSON.parse(JSON.stringify(frame))));
    styles.add(`${plan.sequential}:${plan.scattered}`);
    const delays = plan.cells.map(cell => cell.delay).sort((a, b) => a - b);
    assert.deepEqual(delays, Array.from({ length }, (_, index) => plan.sequential ? index * 180 : 0));
    assert.equal(plan.duration, FEEDBACK_TIMING.burst + delays.at(-1)!, 'Dust and flying debris must not postpone gravity');
    assert.ok(comboDelayMs(frame) >= plan.duration + FEEDBACK_TIMING.fall + 330);
  }
  assert.equal(styles.size, 4, 'Both sequential/simultaneous and wide/small bursts occur');
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
test('All 78 catalogued original files are present and distinct; silent scheduling still follows cascades', () => {
  assert.equal(ORIGINAL_SOUND_FILES.length, 78); assert.equal(new Set(ORIGINAL_SOUND_FILES).size, 78);
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

test('Side-ejected stones sound and break only at floor impact; the next turn waits', () => {
  for (const side of ['left', 'right'] as const) {
    const game = newGame(); game.board = empty(); game.board[4] = ['cherry', 'lemon', 'grape', 'melon', 'bar']; game.queue[0] = 'bell';
    const next = play(game, 0, { side, lane: 4 }), last = next.lastMove!;
    const impact = sideEjectImpactMs(game.board, last.move);
    assert.equal(impact, FEEDBACK_TIMING.insert + FEEDBACK_TIMING.ejectTip + FEEDBACK_TIMING.ejectFall);
    const cues = turnSounds(last, [0, 0], [60, 0], 0, true, game.board);
    assert.equal(cues.find(cue => cue.kind === 'stone' && cue.action === 'burst')!.delay, impact);
    assert.equal(cues.find(cue => cue.kind === 'stone' && cue.action === 'drop')!.delay, impact);
    assert.equal(boardMotionMs(last, game.board), impact + FEEDBACK_TIMING.burst);
    assert.equal(cues.find(cue => cue.kind === 'voice')!.delay, impact + FEEDBACK_TIMING.burst);
    game.board[4][2] = null;
    assert.equal(sideEjectImpactMs(game.board, last.move), 0);
  }
});
