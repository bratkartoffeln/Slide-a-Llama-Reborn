import type { Game, Seat } from '../shared/game';
import { MATCH_SOUNDS, LAMA_SOUNDS, COMBO_SOUND } from './audio-catalog';
import { SoundVariants, turnSounds, type TurnSound } from './sound-events';

type Cue = 'move' | 'match' | 'combo' | 'win' | 'chat';
type Channel = 'effect' | 'voice' | 'accent';

/** Local original effects follow each resolved turn in either visual theme. */
export class GameAudio {
  private context: AudioContext | null = null;
  private samples = new Map<HTMLAudioElement, Channel>();
  private oscillators = new Set<OscillatorNode>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private variants = new SoundVariants();
  private generation = 0;
  enabled = false;
  voicesEnabled = true;
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.cancel(); }
  setVoicesEnabled(enabled: boolean) {
    this.voicesEnabled = enabled;
    if (!enabled) for (const [sample, channel] of this.samples) if (channel === 'voice') this.stopSample(sample);
  }
  cancel() {
    this.generation++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const sample of this.samples.keys()) this.stopSample(sample);
    for (const oscillator of this.oscillators) { try { oscillator.stop(); } catch {} }
    this.oscillators.clear();
  }
  playTurn(last: NonNullable<Game['lastMove']>, before: [number, number], after: [number, number], you: Seat, animated: boolean) {
    this.cancel();
    if (!this.enabled || document.hidden) return;
    const generation = this.generation;
    for (const cue of turnSounds(last, before, after, you, animated)) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.enabled && !document.hidden && generation === this.generation) this.emit(cue);
      }, cue.delay);
      this.timers.add(timer);
    }
  }
  private emit(cue: TurnSound) {
    if (cue.kind === 'move') { this.play('move'); return; }
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
    const active = [...this.samples].filter(([, c]) => c === channel).map(([sample]) => sample);
    for (const sample of active) sample.volume = .12;
    while (active.length >= (channel === 'effect' ? 2 : 1)) this.stopSample(active.shift()!);
    const sample = new Audio(file); sample.volume = volume;
    const generation = this.generation;
    this.samples.set(sample, channel);
    sample.addEventListener('ended', () => this.samples.delete(sample), { once: true });
    void sample.play().catch(() => {
      this.stopSample(sample);
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
