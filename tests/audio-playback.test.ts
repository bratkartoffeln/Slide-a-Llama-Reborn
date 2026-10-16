import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../client/sound';
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
  try {
    const game = newGame(); const last = play(game, 0, { side: 'top', lane: 0 }).lastMove!;
    audio.playTurn(last, [0, 0], [60, 0], 0, false, game.board, 'room:1:1');
    await new Promise(resolve => setTimeout(resolve, 25));
    const firstVoice = samples.find(sample => sample.src.includes('transhappy'))!;
    assert.ok(firstVoice);
    const played = samples.length;
    audio.playTurn(last, [0, 0], [60, 0], 0, false, game.board, 'room:1:1');
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(samples.length, played);
    audio.playTurn(last, [0, 0], [60, 0], 1, false, game.board);
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(firstVoice.pauses, 0);
    assert.equal(samples.filter(sample => sample.src.includes('transhappy')).length, 1);
    assert.equal(samples.filter(sample => sample.src.includes('transpissed')).length, 0);
    firstVoice.dispatchEvent(new Event('ended'));
    assert.equal(samples.filter(sample => sample.src.includes('transpissed')).length, 1);
    audio.setEnabled(false);
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
