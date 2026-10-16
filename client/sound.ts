import type { Board, Game, Seat } from '../shared/game';
import { MATCH_SOUNDS, LAMA_SOUNDS, COMBO_SOUND, STONE_SOUNDS, CHAT_SOUND, IDLE_LAMA_SOUNDS, MUSIC_SOUND, THUNDER_SOUND, RESULT_SOUNDS } from './audio-catalog';
import { SoundVariants, turnSounds, type TurnSound } from './sound-events';

type Cue = 'move' | 'match' | 'combo' | 'win' | 'chat';
type Channel = 'effect' | 'voice' | 'accent' | 'stone' | 'chat' | 'idle';
type SampleRequest = { file: string; channel: Channel; volume: number; fallback: Cue };

/** Music loops independently of every SFX channel and pauses outside active play. */
export class GameMusic {
  private sample: HTMLAudioElement | null = null;
  private active = false;
  private enabled = false;
  private starting = false;
  setEnabled(enabled: boolean) { this.enabled = enabled; this.refresh(); }
  setPlaying(active: boolean) { if (this.active !== active) { this.active = active; this.refresh(); } }
  refresh() {
    if (!this.enabled || !this.active || document.hidden) { this.sample?.pause(); return; }
    this.sample ??= new Audio(MUSIC_SOUND);
    this.sample.loop = true; this.sample.volume = .12;
    if (!this.sample.paused || this.starting) return;
    this.starting = true;
    void this.sample.play().catch(() => { /* Retry after the next user interaction if autoplay was blocked. */ }).finally(() => { this.starting = false; });
  }
}

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
  private lastActivity = 0;
  enabled = false;
  voicesEnabled = true;
  playChat() { if (this.enabled) { this.stopIdle(); this.original(CHAT_SOUND, 'chat', .5, 'chat'); } }
  playResult(won: boolean) {
    if (!this.enabled || document.hidden) return;
    this.stopIdle(); this.original(RESULT_SOUNDS[won ? 'won' : 'lost'], 'voice', .35, won ? 'win' : 'chat');
  }
  playIdleLama(): boolean {
    if (!this.enabled || !this.voicesEnabled || document.hidden || this.samples.size || this.queue.length || this.timers.size || Date.now() - this.lastActivity < 10000) return false;
    this.original(this.variants.next('idle', IDLE_LAMA_SOUNDS), 'idle', .22, 'chat');
    return true;
  }
  private stopIdle() { for (const [sample, channel] of this.samples) if (channel === 'idle') this.stopSample(sample); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.cancel(); }
  setVoicesEnabled(enabled: boolean) {
    this.voicesEnabled = enabled;
    if (!enabled) this.stopIdle();
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
    this.stopIdle(); this.lastActivity = Date.now();
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
    if (cue.kind === 'thunder') { this.original(THUNDER_SOUND, 'accent', .35, 'move'); return; }
    if (cue.kind === 'stone') { this.original(STONE_SOUNDS[cue.action], 'stone', cue.action === 'settle' ? .2 : .42, 'move'); return; }
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
    this.lastActivity = Date.now();
    const active = [...this.samples.values()].filter(c => c === channel).length;
    const limit = channel === 'voice' ? 1 : channel === 'effect' || channel === 'stone' ? 4 : 2;
    if (active >= limit) { this.queue.push({ file, channel, volume, fallback }); return; }
    const sample = new Audio(file); sample.volume = volume;
    const generation = this.generation;
    this.samples.set(sample, channel);
    const finish = () => {
      if (!this.samples.delete(sample) || generation !== this.generation) return;
      this.lastActivity = Date.now();
      const next = this.queue.findIndex(request => request.channel === channel);
      if (next >= 0) { const request = this.queue.splice(next, 1)[0]; this.original(request.file, request.channel, request.volume, request.fallback); }
    };
    sample.addEventListener('ended', finish, { once: true });
    sample.addEventListener('error', finish, { once: true });
    void sample.play().catch(() => {
      finish();
      if (channel !== 'idle' && this.enabled && generation === this.generation && (channel !== 'voice' || this.voicesEnabled)) this.play(fallback);
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
