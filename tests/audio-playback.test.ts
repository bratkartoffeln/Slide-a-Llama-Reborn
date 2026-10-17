import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio, GameMusic } from '../client/sound';
import { newGame, play } from '../shared/game';

test('New turns let original samples finish; queued voices resume on ended and mute clears all playback', async () => {
  const samples: FakeAudio[] = [];
  class FakeAudio extends EventTarget {
    volume = 1; currentTime = 0; pauses = 0;
    constructor(public src: string) { super(); samples.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.pauses++; }
  }
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  const audio = new GameAudio(); audio.setEnabled(true);
  const speakers: string[] = []; let stopped = 0;
  audio.onLamaVoice = voice => { speakers.push(voice.kind); return () => { stopped++; }; };
  try {
    const game = newGame();
    // This test exercises the voice queue, not randomly generated cascades and their delays.
    game.board = Array.from({ length: 5 }, () => Array(5).fill(null));
    const last = play(game, 0, { side: 'top', lane: 0 }).lastMove!;
    audio.playTurn(last, [0, 0], [60, 0], 0, false, game.board, 'room:1:1');
    await new Promise(resolve => setTimeout(resolve, 25));
    const firstVoice = samples.find(sample => sample.src.includes('transhappy'))!;
    assert.ok(firstVoice);
    assert.equal(speakers.length, 0);
    firstVoice.dispatchEvent(new Event('playing'));
    assert.deepEqual(speakers, ['transfer']);
    const played = samples.length;
    audio.playTurn(last, [0, 0], [60, 0], 0, false, game.board, 'room:1:1');
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(samples.length, played);
    audio.playTurn(last, [0, 0], [60, 0], 1, false, game.board);
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(firstVoice.pauses, 0);
    assert.equal(samples.filter(sample => sample.src.includes('transhappy')).length, 1);
    assert.equal(samples.filter(sample => sample.src.includes('transpissed')).length, 0);
    assert.equal(speakers.length, 1);
    firstVoice.dispatchEvent(new Event('ended'));
    assert.equal(stopped, 1);
    assert.equal(samples.filter(sample => sample.src.includes('transpissed')).length, 1);
    const secondVoice = samples.find(sample => sample.src.includes('transpissed'))!;
    secondVoice.dispatchEvent(new Event('playing')); assert.equal(speakers.length, 2);
    secondVoice.dispatchEvent(new Event('waiting')); assert.equal(stopped, 2);
    secondVoice.dispatchEvent(new Event('playing')); assert.equal(speakers.length, 3);
    audio.setEnabled(false);
    assert.equal(stopped, 3);
    assert.ok(samples.filter(sample => sample !== firstVoice).every(sample => sample.pauses > 0));
    const count = samples.length;
    samples.at(-1)!.dispatchEvent(new Event('ended'));
    assert.equal(samples.length, count);
  } finally {
    audio.cancel();
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('Original background music loops independently of SFX and follows its own mute and visibility state', async () => {
  const samples: FakeMusic[] = [];
  class FakeMusic {
    volume = 1; loop = false; paused = true; plays = 0; pauses = 0;
    constructor(public src: string) { samples.push(this); }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; this.pauses++; }
  }
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio'), originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const visibility = { hidden: false };
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeMusic });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: visibility });
  try {
    const music = new GameMusic(); music.setEnabled(true); assert.equal(samples.length, 0);
    music.setPlaying(true); await Promise.resolve(); await Promise.resolve();
    const sample = samples[0]; assert.match(sample.src, /background-music\.mp3$/); assert.equal(sample.loop, true); assert.equal(sample.paused, false);
    const sfx = new GameAudio(); sfx.setEnabled(false); assert.equal(sample.paused, false);
    visibility.hidden = true; music.refresh(); assert.equal(sample.paused, true);
    visibility.hidden = false; music.refresh(); await Promise.resolve(); await Promise.resolve(); assert.equal(sample.paused, false);
    music.setEnabled(false); assert.equal(sample.paused, true);
    music.setPlaying(false); music.setEnabled(true); assert.equal(sample.paused, true);
  } finally {
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('Idle originals stay out of active turns and respect voice and sound switches', async () => {
  const samples: FakeAudio[] = [];
  class FakeAudio extends EventTarget {
    volume = 1; currentTime = 0; pauses = 0;
    constructor(public src: string) { super(); samples.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.pauses++; }
  }
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio'), originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalNow = Date.now; let now = 20000; Date.now = () => now;
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } });
  const audio = new GameAudio();
  try {
    assert.equal(audio.playIdleLama(), false);
    audio.setEnabled(true); audio.setVoicesEnabled(false); assert.equal(audio.playIdleLama(), false);
    audio.setVoicesEnabled(true); assert.equal(audio.playIdleLama(), true);
    const idle = samples.at(-1)!; assert.match(idle.src, /lama-idle-\d\.mp3$/);
    assert.equal(audio.playIdleLama(), false);
    const game = newGame(), last = play(game, 0, { side: 'top', lane: 0 }).lastMove!;
    audio.playTurn(last, [0, 0], [0, 0], 0, false, game.board, 'idle-test');
    assert.equal(idle.pauses, 1); assert.equal(audio.playIdleLama(), false);
    audio.cancel(); now += 11000;
    assert.equal(audio.playIdleLama(), true);
    audio.setVoicesEnabled(false); assert.equal(samples.at(-1)!.pauses, 1);
    now += 11000; audio.setVoicesEnabled(true); audio.setEnabled(false); assert.equal(audio.playIdleLama(), false);
  } finally {
    audio.cancel(); Date.now = originalNow;
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('Start jingle and result voices obey SFX mute and visibility', async () => {
  const samples: FakeAudio[] = [];
  class FakeAudio extends EventTarget {
    volume = 1; currentTime = 0;
    constructor(public src: string) { super(); samples.push(this); }
    play() { return Promise.resolve(); }
    pause() {}
  }
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio'), originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  const visibility = { hidden: false };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: visibility });
  const audio = new GameAudio();
  try {
    audio.playStart(); assert.equal(samples.length, 0);
    audio.playResult(true); assert.equal(samples.length, 0);
    audio.setEnabled(true); audio.playResult(true); assert.match(samples[0].src, /lama-victory\.mp3$/);
    audio.playResult(false); assert.equal(samples.length, 1);
    samples[0].dispatchEvent(new Event('ended')); assert.match(samples[1].src, /lama-defeat\.mp3$/);
    audio.setEnabled(false); audio.playResult(false); assert.equal(samples.length, 2);
    audio.playStart(); assert.equal(samples.length, 2);
    audio.setEnabled(true); visibility.hidden = true;
    audio.playStart(); assert.equal(samples.length, 2);
    visibility.hidden = false; audio.playStart();
    assert.match(samples[2].src, /temple-start\.wav$/); assert.equal(samples[2].volume, .35);
  } finally {
    audio.cancel();
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
