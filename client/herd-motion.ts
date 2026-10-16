import { llama, follower } from './art';
import type { Seat } from '../shared/game';
import { FEEDBACK_TIMING } from '../shared/feedback';

/** Stable identities let a converted follower actually walk from its old slot. */
export class HerdMotion {
  private teams: [number[], number[]] = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private scheduled = new Set<HTMLElement>();
  private animations = new Set<Animation>();
  constructor(private root: HTMLElement, private enabled: () => boolean) {}
  clear() {
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
    this.scheduled.clear();
    for (const animation of this.animations) animation.cancel(); this.animations.clear();
    this.root.querySelectorAll('.is-crossing').forEach(element => element.classList.remove('is-crossing'));
  }
  render(count: number, transfer: boolean) {
    if (this.root.children.length === 10 && this.teams[0].length === count) return;
    this.clear();
    const old = new Map([...this.root.querySelectorAll<HTMLElement>('.mini-llama')].map(element => [Number(element.dataset.llama), { x: element.getBoundingClientRect().left, team: element.dataset.team }]));
    while (this.teams[0].length < count) this.teams[0].push(this.teams[1].pop()!);
    while (this.teams[0].length > count) this.teams[1].push(this.teams[0].pop()!);
    this.root.innerHTML = this.teams.map((ids, team) => ids.map(id => `<span class="mini-llama team-${team === 0 ? 'zero' : 'one'}" data-llama="${id}" data-team="${team}"><span class="llama-life">${llama(team === 0 ? '#eee0c4' : '#d3e0d4', team === 0 ? '#ce7855' : '#5c8977')}${follower(team as Seat)}</span></span>`).join('')).join('');
    if (transfer && this.enabled()) for (const element of this.root.querySelectorAll<HTMLElement>('.mini-llama')) {
      const previous = old.get(Number(element.dataset.llama)); if (!previous) continue;
      const dx = previous.x - element.getBoundingClientRect().left, converted = previous.team !== element.dataset.team;
      if (converted) element.classList.add('is-crossing');
      if (dx || converted) this.animate(element, converted ? [
        { translate: `${dx}px 0`, rotate: '0deg' }, { translate: `${dx * .75}px -5px`, rotate: '-3deg', offset: .25 },
        { translate: `${dx * .5}px 0`, rotate: '3deg', offset: .5 }, { translate: `${dx * .25}px -5px`, rotate: '-2deg', offset: .75 }, { translate: '0 0', rotate: '0deg' }
      ] : [{ translate: `${dx}px 0` }, { translate: '0 0' }], converted ? FEEDBACK_TIMING.transfer : 900, () => element.classList.remove('is-crossing'));
    }
    this.refresh();
  }
  refresh() {
    if (!this.enabled() || document.hidden) {
      for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); this.scheduled.clear(); return;
    }
    // State updates must not keep postponing a follower's next blink.
    for (const figure of this.root.querySelectorAll<HTMLElement>('.llama-life')) if (!this.scheduled.has(figure)) this.schedule(figure, 1800 + Math.random() * 4500);
  }
  react() {
    if (!this.enabled() || document.hidden) return;
    const figures = [...this.root.querySelectorAll<HTMLElement>('.mini-llama:not(.is-crossing) .llama-life')];
    const figure = figures[Math.floor(Math.random() * figures.length)];
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
