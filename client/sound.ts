import type { Board, Game, Seat } from '../shared/game';
import { MATCH_SOUNDS, LAMA_SOUNDS, COMBO_SOUND, STONE_SOUNDS, CHAT_SOUND } from './audio-catalog';
import { SoundVariants, turnSounds, type TurnSound } from './sound-events';

type Cue = 'move' | 'match' | 'combo' | 'win' | 'chat';
type Channel = 'effect' | 'voice' | 'accent' | 'stone' | 'chat';
type SampleRequest = { file: string; channel: Channel; volume: number; fallback: Cue };

/** Local original effects follow each resolved turn in either visual theme. */
export class GameAudio {
  private context: AudioContext | null = null;
  private samples = new Map<HTMLAudioElement, Channel>();
  private oscillators = new Set<OscillatorNode>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private variants = new SoundVariants();
  private generation = 0;
  private queue: SampleRequest[] = [];
  private lastTurnId: string | undefined;
  enabled = false;
  voicesEnabled = true;
  playChat() { if (this.enabled) this.original(CHAT_SOUND, 'chat', .5, 'chat'); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.cancel(); }
  setVoicesEnabled(enabled: boolean) {
    this.voicesEnabled = enabled;
    if (!enabled) this.queue = this.queue.filter(request => request.channel !== 'voice');
    if (!enabled) for (const [sample, channel] of this.samples) if (channel === 'voice') this.stopSample(sample);
  }
  cancel() {
    this.lastTurnId = undefined;
    this.generation++;
    this.queue = [];
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const sample of this.samples.keys()) this.stopSample(sample);
    for (const oscillator of this.oscillators) { try { oscillator.stop(); } catch {} }
    this.oscillators.clear();
  }
  playTurn(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number], you: Seat, animated: boolean, previous: Board, turnId?: string) {
    // Let previous samples finish, including long original voices. Only leaving,
    // muting or hiding the game cancels playback and pending events.
    if (!this.enabled || document.hidden) return;
    if (turnId && turnId === this.lastTurnId) return;
    this.lastTurnId = turnId;
    const generation = this.generation;
    for (const cue of turnSounds(last, before, after, you, animated, previous)) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.enabled && !document.hidden && generation === this.generation) this.emit(cue);
      }, cue.delay);
      this.timers.add(timer);
    }
  }
  private emit(cue: TurnSound) {
    if (cue.kind === 'stone') { this.original(STONE_SOUNDS[cue.action], 'stone', .42, 'move'); return; }
    if (cue.kind === 'voice') {
      if (this.voicesEnabled) this.original(this.variants.next('voice-' + cue.mood, LAMA_SOUNDS[cue.mood]), 'voice', .4, 'chat');
    } else if (cue.kind === 'combo') this.original(COMBO_SOUND, 'accent', .24, 'combo');
    else if (cue.kind === 'match') this.original(this.variants.next(cue.tile, MATCH_SOUNDS[cue.tile]), 'effect', .38, 'match');
  }
  private stopSample(sample: HTMLAudioElement) {
    sample.pause(); this.samples.delete(sample);
    try { sample.currentTime = 0; } catch {}
  }
  private original(file: string, channel: Channel, volume: number, fallback: Cue) {
    const active = [...this.samples.values()].filter(c => c === channel).length;
    const limit = channel === 'voice' ? 1 : channel === 'effect' || channel === 'stone' ? 4 : 2;
    if (active >= limit) { this.queue.push({ file, channel, volume, fallback }); return; }
    const sample = new Audio(file); sample.volume = volume;
    const generation = this.generation;
    this.samples.set(sample, channel);
    const finish = () => {
      if (!this.samples.delete(sample) || generation !== this.generation) return;
      const next = this.queue.findIndex(request => request.channel === channel);
      if (next >= 0) { const request = this.queue.splice(next, 1)[0]; this.original(request.file, request.channel, request.volume, request.fallback); }
    };
    sample.addEventListener('ended', finish, { once: true });
    sample.addEventListener('error', finish, { once: true });
    void sample.play().catch(() => {
      finish();
      if (this.enabled && generation === this.generation && (channel !== 'voice' || this.voicesEnabled)) this.play(fallback);
    });
  }
  play(cue: Cue) {
    if (!this.enabled || document.hidden) return;
    try {
      this.context ??= new AudioContext(); void this.context.resume();
      const notes: Record<Cue, number[]> = { move: [180, 120], match: [523, 659, 784], combo: [659, 784, 1047], win: [523, 659, 784, 1047], chat: [880, 660] };
      for (const [i, frequency] of notes[cue].entries()) {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        const start = this.context.currentTime + i * .055;
        oscillator.type = cue === 'move' ? 'triangle' : 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.025, start); gain.gain.exponentialRampToValueAtTime(.001, start + .14);
        oscillator.connect(gain); gain.connect(this.context.destination); this.oscillators.add(oscillator);
        oscillator.onended = () => { this.oscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + .16);
      }
    } catch { /* Audio remains optional, including browsers without an audio device. */ }
  }
}
