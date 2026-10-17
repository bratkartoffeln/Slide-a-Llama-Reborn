import { llama, follower } from './art';
import type { Seat } from '../shared/game';
import { FEEDBACK_TIMING } from '../shared/feedback';
import type { LamaVoice } from './sound';

/** Stable identities let a converted follower actually walk from its old slot. */
export class HerdMotion {
  private teams: [number[], number[]] = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private scheduled = new Set<HTMLElement>();
  private animations = new Set<Animation>();
  private walks = new Set<number>();
  private speaking: { id: number; token: symbol } | null = null;
  constructor(private root: HTMLElement, private enabled: () => boolean) {}
  clear(preserveSpeech = false) {
    if (!preserveSpeech) this.speaking = null;
    this.root.querySelectorAll('.is-speaking').forEach(element => element.classList.remove('is-speaking'));
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
    this.scheduled.clear();
    for (const animation of this.animations) animation.cancel(); this.animations.clear();
    for (const frame of this.walks) cancelAnimationFrame(frame); this.walks.clear();
    this.root.querySelectorAll('.is-crossing').forEach(element => element.classList.remove('is-crossing'));
    this.root.querySelectorAll<HTMLElement>('.mini-llama').forEach(element => this.paint(element, Number(element.dataset.team) as Seat));
  }
  render(count: number, transfer: boolean) {
    if (this.root.children.length === 10 && this.teams[0].length === count) return;
    this.clear(true);
    const old = new Map([...this.root.querySelectorAll<HTMLElement>('.mini-llama')].map(element => {
      const rect = element.getBoundingClientRect();
      return [Number(element.dataset.llama), { x: rect.left + rect.width / 2, y: rect.bottom, team: element.dataset.side }];
    }));
    while (this.teams[0].length < count) this.teams[0].push(this.teams[1].pop()!);
    while (this.teams[0].length > count) this.teams[1].push(this.teams[0].pop()!);
    this.root.innerHTML = this.teams.map((ids, team) => ids.map((id, index) => {
      const column = index % 5, row = Math.floor(index / 5);
      const x = team === 0 ? 7 + column * 7.5 : 93 - column * 7.5;
      const height = row * 13 + (column % 2) * 5;
      return `<span class="mini-llama team-${team === 0 ? 'zero' : 'one'}" data-llama="${id}" data-team="${team}" style="left:${x}%;bottom:${height}px;z-index:${3 - row}"><span class="llama-life">${llama(team === 0 ? '#eee0c4' : '#d3e0d4', team === 0 ? '#ce7855' : '#5c8977')}${follower(team as Seat)}</span></span>`;
    }).join('')).join('');
    this.root.querySelectorAll<HTMLElement>('.mini-llama').forEach(element => this.paint(element, Number(element.dataset.team) as Seat));
    if (transfer && this.enabled()) for (const element of this.root.querySelectorAll<HTMLElement>('.mini-llama')) {
      const previous = old.get(Number(element.dataset.llama)); if (!previous) continue;
      const rect = element.getBoundingClientRect();
      const dx = previous.x - rect.left - rect.width / 2, dy = previous.y - rect.bottom, converted = previous.team !== element.dataset.team;
      if (converted) element.classList.add('is-crossing');
      if (converted) this.paint(element, Number(previous.team) as Seat);
      if (dx || converted) this.animate(element, converted ? [
        { translate: `${dx}px ${dy}px`, rotate: '0deg' }, { translate: `${dx * .75}px ${dy * .75 - 5}px`, rotate: '-3deg', offset: .25 },
        { translate: `${dx * .5}px ${dy * .5}px`, rotate: '3deg', offset: .5 }, { translate: `${dx * .25}px ${dy * .25 - 5}px`, rotate: '-2deg', offset: .75 }, { translate: '0 0', rotate: '0deg' }
      ] : [{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], converted ? FEEDBACK_TIMING.transfer : 900, () => {
        element.classList.remove('is-crossing'); this.paint(element, Number(element.dataset.team) as Seat);
      });
      if (converted) this.followSide(element);
    }
    this.paintSpeech(); this.refresh();
  }
  private paint(element: HTMLElement, side: Seat) {
    element.dataset.side = String(side);
    element.style.setProperty('--llama-accessory', side === 0 ? '#d84d55' : '#587bdb');
    const filter = element.querySelector('filter')?.id;
    element.querySelector('.retro-follower image')?.setAttribute('filter', side === 0 && filter ? `url(#${filter})` : 'none');
  }
  private followSide(element: HTMLElement) {
    const frame = requestAnimationFrame(() => {
      this.walks.delete(frame);
      if (!element.isConnected || !element.classList.contains('is-crossing')) return;
      const root = this.root.getBoundingClientRect(), rect = element.getBoundingClientRect();
      this.paint(element, rect.left + rect.width / 2 < root.left + root.width / 2 ? 0 : 1);
      this.followSide(element);
    });
    this.walks.add(frame);
  }
  refresh() {
    if (!this.enabled() || document.hidden) {
      for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); this.scheduled.clear(); return;
    }
    // State updates must not keep postponing a follower's next blink.
    for (const figure of this.root.querySelectorAll<HTMLElement>('.llama-life')) if (!this.scheduled.has(figure)) this.schedule(figure, 1800 + Math.random() * 4500);
  }
  speak(voice: LamaVoice): () => void {
    if (!this.enabled() || document.hidden) return () => {};
    let candidates = this.teams.flat();
    if (voice.kind === 'transfer') {
      const current = this.teams[voice.team];
      // Audio may start just before the visual transfer rebuilds the herd.
      candidates = voice.count > current.length
        ? this.teams[voice.team === 0 ? 1 : 0].slice(-(voice.count - current.length))
        : current.slice(-Math.max(1, voice.moved));
    }
    const id = candidates[Math.floor(Math.random() * candidates.length)];
    if (id === undefined) return () => {};
    const token = Symbol(); this.speaking = { id, token }; this.paintSpeech();
    if (voice.kind === 'idle') this.react(this.root.querySelector<HTMLElement>(`[data-llama="${id}"] .llama-life`) ?? undefined);
    return () => { if (this.speaking?.token === token) { this.speaking = null; this.paintSpeech(); } };
  }
  private paintSpeech() {
    this.root.querySelectorAll<HTMLElement>('.mini-llama').forEach(element => {
      element.classList.toggle('is-speaking', this.speaking?.id === Number(element.dataset.llama));
    });
  }
  private react(selected?: HTMLElement) {
    if (!this.enabled() || document.hidden) return;
    const figures = [...this.root.querySelectorAll<HTMLElement>('.mini-llama:not(.is-crossing) .llama-life')];
    const figure = selected ?? figures[Math.floor(Math.random() * figures.length)];
    if (figure) this.animate(figure, [{ scale: '1 1', rotate: '0deg' }, { scale: '1.025 .96', rotate: '-3deg', offset: .35 }, { scale: '.99 1.015', rotate: '2deg', offset: .65 }, { scale: '1 1', rotate: '0deg' }], 1400);
  }
  private schedule(figure: HTMLElement, delay: number) {
    this.scheduled.add(figure);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.scheduled.delete(figure);
      if (!this.enabled() || document.hidden || !figure.isConnected) return;
      if (!figure.parentElement?.classList.contains('is-crossing')) {
        const variant = Math.random();
        figure.querySelectorAll('.llama-eyes').forEach(eyes => this.animate(eyes, [{ scale: '1 1' }, { scale: '1 .05', offset: .35 }, { scale: '1 .05', offset: .65 }, { scale: '1 1' }], 160));
        figure.querySelectorAll('.retro-eyelid').forEach(eyes => this.animate(eyes, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], 160));
        if (variant > .65) this.animate(figure, [{ scale: '1 1', rotate: '0deg' }, { scale: variant < .85 ? '1.015 .975' : '.992 1.01', rotate: variant < .85 ? '0deg' : '1.3deg', offset: .5 }, { scale: '1 1', rotate: '0deg' }], 2000);
      }
      this.schedule(figure, 3000 + Math.random() * 6500);
    }, delay);
    this.timers.add(timer);
  }
  private animate(element: Element, frames: Keyframe[], duration: number, done?: () => void) {
    const animation = element.animate(frames, { duration, easing: 'ease-in-out' }); this.animations.add(animation);
    void animation.finished.catch(() => {}).finally(() => { this.animations.delete(animation); done?.(); });
  }
}
