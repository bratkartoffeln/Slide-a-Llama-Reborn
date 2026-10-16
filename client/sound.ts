type Cue = 'move' | 'match' | 'combo' | 'transfer' | 'win' | 'chat';
const originals: Partial<Record<Cue, string>> = {
  match: '/audio/retro-match.mp3', combo: '/audio/retro-combo.mp3', transfer: '/audio/retro-transfer.mp3'
};

/** Effects only: audio starts after opting in and stops immediately when muted. */
export class GameAudio {
  private context: AudioContext | null = null;
  private samples = new Map<string, HTMLAudioElement>();
  private voices = new Set<OscillatorNode>();
  enabled = false;
  retro = false;
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      for (const sample of this.samples.values()) { sample.pause(); sample.currentTime = 0; }
      for (const voice of this.voices) { try { voice.stop(); } catch {} }
      this.voices.clear();
    }
  }
  play(cue: Cue) {
    if (!this.enabled || document.hidden) return;
    const file = this.retro && originals[cue];
    if (file) {
      let sample = this.samples.get(file);
      if (!sample) { sample = new Audio(file); sample.volume = .3; this.samples.set(file, sample); }
      sample.currentTime = 0;
      void sample.play().catch(() => this.tone(cue));
    } else this.tone(cue);
  }
  private tone(cue: Cue) {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext(); void this.context.resume();
      const notes: Record<Cue, number[]> = {
        move: [180, 120], match: [523, 659, 784], combo: [659, 784, 1047],
        transfer: [392, 523], win: [523, 659, 784, 1047], chat: [880, 660]
      };
      for (const [i, frequency] of notes[cue].entries()) {
        const voice = this.context.createOscillator(), gain = this.context.createGain();
        const start = this.context.currentTime + i * .055;
        voice.type = cue === 'move' ? 'triangle' : 'sine'; voice.frequency.value = frequency;
        gain.gain.setValueAtTime(.035, start); gain.gain.exponentialRampToValueAtTime(.001, start + .14);
        voice.connect(gain); gain.connect(this.context.destination); this.voices.add(voice);
        voice.onended = () => { this.voices.delete(voice); voice.disconnect(); gain.disconnect(); };
        voice.start(start); voice.stop(start + .16);
      }
    } catch { /* Audio is optional, including browsers without an audio device. */ }
  }
}
