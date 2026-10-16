import { fruit } from './art';
import { findMatches, type Board, type Frame, type Move } from '../shared/game';
import { burstPlan, comboDelayMs, comboFactor, FEEDBACK_TIMING, sideEjectImpactMs } from '../shared/feedback';
import threeKind from '../public/retro/three-of-a-kind.svg?raw';
import fourKind from '../public/retro/four-of-a-kind.svg?raw';
import fiveKind from '../public/retro/five-of-a-kind.svg?raw';

/** A bounded overlay keeps transient fragments and score labels out of the game grid. */
export class BoardFeedback {
  private animations = new Set<Animation>();
  private generation = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  async settle() {
    await Promise.all([...this.animations].map(animation => animation.finished.catch(() => {})));
  }
  constructor(private scene: HTMLElement, private layer: HTMLElement, private enabled: () => boolean) {}
  clear() {
    this.generation++;
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
    for (const animation of this.animations) animation.cancel();
    this.animations.clear(); this.layer.replaceChildren();
    this.scene.querySelectorAll('.stone-cracks').forEach(element => element.remove());
    this.scene.querySelectorAll('.cracking').forEach(element => element.classList.remove('cracking'));
    this.scene.querySelectorAll('.match-announcement').forEach(element => element.remove());
    delete this.scene.dataset.motionPhase;
    delete this.scene.dataset.burstStyle;
  }
  crackBottom(board: Board, lane: number, tile: NonNullable<Board[number][number]>, origin?: { left: number; top: number }) {
    if (!this.enabled()) return;
    const source = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="4"][data-col="${lane}"]`)!;
    source.classList.add('cracking');
    source.insertAdjacentHTML('beforeend', '<svg class="stone-cracks" viewBox="0 0 100 100" aria-hidden="true"><path d="M48 0 43 25 59 40 40 60 48 80 37 100 M59 40 82 30 100 37 M40 60 17 48 0 55 M48 80 73 68 98 78"/></svg>');
    const top = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="0"][data-col="${lane}"]`)!.getBoundingClientRect();
    const bounds = this.scene.getBoundingClientRect(), waiting = document.createElement('span');
    waiting.className = 'waiting-stone';
    const contact = { left: top.left, top: top.top - top.height };
    Object.assign(waiting.style, { left: contact.left - bounds.left + 'px', top: contact.top - bounds.top + 'px', width: top.width + 'px', height: top.height + 'px' });
    waiting.innerHTML = `<span class="tile">${fruit(tile)}</span>`; this.layer.append(waiting);
    if (origin) {
      const approach = waiting.animate([
        { transform: `translate(${origin.left - contact.left}px,${origin.top - contact.top}px)` },
        { transform: 'none' }
      ], { duration: 180, easing: 'ease-in' });
      this.animations.add(approach);
      void approach.finished.catch(() => {}).finally(() => this.animations.delete(approach));
    }
  }
  releaseWaitingStone() {
    this.layer.querySelectorAll('.waiting-stone').forEach(element => element.remove());
  }
  async blinkMatches(frame: Frame) {
    if (!this.enabled()) return;
    await Promise.all(frame.matches.map(([row, col]) => {
      const tile = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="${row}"][data-col="${col}"]`)!;
      const outline = document.createElement('span'); outline.className = 'match-outline';
      outline.setAttribute('aria-hidden', 'true'); tile.append(outline);
      const animation = outline.animate([{ opacity: 1 }, { opacity: 0, offset: .5 }, { opacity: 1 }], {
        duration: FEEDBACK_TIMING.matchBlink / 3, iterations: 3, easing: 'steps(1,end)'
      });
      this.animations.add(animation);
      return animation.finished.catch(() => {}).finally(() => { this.animations.delete(animation); outline.remove(); });
    }));
  }
  announceMatch(frame: Frame) {
    if (!this.enabled()) return;
    // Crossing triples are still triples, even if their union contains five cells.
    const length = Math.max(...findMatches(frame.board).map(match => match.cells.length));
    const word = length === 5 ? 'Five' : length === 4 ? 'Four' : 'Three';
    const label = document.createElement('span'); label.className = 'match-announcement';
    label.dataset.length = String(length); label.setAttribute('role', 'img'); label.setAttribute('aria-label', `${word} of a Kind`);
    label.innerHTML = length === 5 ? fiveKind : length === 4 ? fourKind : threeKind;
    this.scene.append(label);
    const style = Math.floor(Math.random() * 4);
    label.dataset.entrance = ['whole-float', 'whole-sweep', 'letters-fall', 'letters-weave'][style];
    const track = (element: Element, frames: Keyframe[], delay = 0) => {
      const animation = element.animate(frames, { duration: 650, delay, fill: 'backwards', easing: 'ease-out' });
      this.animations.add(animation);
      void animation.finished.catch(() => {}).finally(() => this.animations.delete(animation));
    };
    const letters = [...label.querySelectorAll<SVGUseElement>('svg>g>use')].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    if (style < 2) {
      const direction = Math.random() < .5 ? -1 : 1;
      track(label.querySelector('svg')!, [
        { translate: style === 0 ? '0 -140px' : `${direction * 220}px -25px`, rotate: `${direction * 12}deg`, scale: '.65', opacity: 0 },
        { translate: '0 5px', rotate: `${-direction * 3}deg`, scale: '1.07', opacity: 1, offset: .75 },
        { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1 }
      ]);
    } else letters.forEach((letter, index) => {
      const direction = index % 2 ? 1 : -1;
      track(letter, [
        { translate: style === 2 ? `${direction * 14}px -180px` : `${direction * 160}px ${direction * 80}px`, rotate: `${direction * (18 + Math.random() * 18)}deg`, scale: '1.3', opacity: 0 },
        { translate: '0 5px', rotate: '-4deg', scale: '.94 1.1', opacity: 1, offset: .72 },
        { translate: '0 -3px', rotate: '2deg', scale: '1.05 .97', opacity: 1, offset: .87 },
        { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1 }
      ], index * 22);
    });
    this.animate(label, [
      { transform: 'translate(-50%,0) scale(1)', opacity: 1 },
      { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: .75 },
      { transform: 'translate(-50%,-35%) scale(1.05)', opacity: 0 }
    ], FEEDBACK_TIMING.matchTitle + FEEDBACK_TIMING.burst + FEEDBACK_TIMING.fall);
  }
  async eject(board: Board, move: Move) {
    if (!this.enabled()) return;
    const { side, lane } = move;
    const impactAt = sideEjectImpactMs(board, move);
    if (!impactAt) return;
    const generation = this.generation;
    const row = lane, col = side === 'left' ? 4 : 0;
    const source = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="${row}"][data-col="${col}"]`)!;
    const bounds = this.scene.getBoundingClientRect(), rect = source.getBoundingClientRect();
    const piece = document.createElement('span'); piece.className = 'ejected-stone';
    Object.assign(piece.style, { left: rect.left - bounds.left + 'px', top: rect.top - bounds.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    piece.innerHTML = source.outerHTML;
    this.layer.append(piece);
    const direction = side === 'left' ? 1 : -1;
    const dx = direction * rect.width * 1.55;
    const floor = bounds.height - 8, dy = Math.max(rect.height * .35, floor - (rect.top - bounds.top) - rect.height);
    piece.dataset.phase = 'ejecting';
    await this.animate(piece, [
      { transform: 'translate(0,0) rotate(0deg)', easing: 'linear' },
      { transform: `translate(${dx * .65}px,0) rotate(0deg)`, offset: FEEDBACK_TIMING.insert / impactAt, easing: 'ease-in' },
      { transform: `translate(${dx}px,0) rotate(${direction * 18}deg)`, offset: (FEEDBACK_TIMING.insert + FEEDBACK_TIMING.ejectTip) / impactAt, easing: 'cubic-bezier(.55,0,1,.65)' },
      { transform: `translate(${dx}px,${dy}px) rotate(${direction * 48}deg)` }
    ], impactAt);
    if (generation !== this.generation || !this.enabled()) return;
    const current = this.scene.getBoundingClientRect();
    this.burst({ board, matches: [[row, col]], points: 0, multiplier: 1 }, true, false, 0, { left: current.left + rect.left - bounds.left + dx, top: current.top + rect.top - bounds.top + dy, width: rect.width, height: rect.height });
    await new Promise(resolve => setTimeout(resolve, FEEDBACK_TIMING.burst));
  }
  burst(frame: Frame, own: boolean, score = true, offsetX = 0, origin?: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>) {
    if (!this.enabled() || !frame.matches.length) return;
    const bounds = this.scene.getBoundingClientRect();
    const plan = burstPlan(frame), scattered = score && plan.scattered, generation = this.generation;
    if (score) this.scene.dataset.burstStyle = `${plan.sequential ? 'sequence' : 'together'}-${scattered ? 'wide' : 'small'}`;
    let centerX = 0, centerY = 0;
    for (const [row, col] of frame.matches) {
      const tile = frame.board[row][col];
      const source = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="${row}"][data-col="${col}"]`);
      if (!tile || !source) continue;
      const rect = origin ?? source.getBoundingClientRect(), x = rect.left - bounds.left + offsetX, y = rect.top - bounds.top;
      centerX += x + rect.width / 2; centerY += y + rect.height / 2;
      const emit = () => {
        if (generation !== this.generation || !this.enabled()) return;
        if (score) source.classList.add('matched');
        const fractureX = 32 + (plan.seed + row * 37 + col * 19) % 33;
        const fractureY = 34 + (plan.seed + row * 17 + col * 41) % 29;
        const joint = `${fractureX}% ${fractureY}%`;
        const shapes = [`polygon(0 0,${fractureX + 8}% 0,${joint},0 ${fractureY - 9}%)`, `polygon(${fractureX + 8}% 0,100% 0,100% ${fractureY + 12}%,${joint})`, `polygon(0 ${fractureY - 9}%,${joint},${fractureX - 7}% 100%,0 100%)`, `polygon(${joint},100% ${fractureY + 12}%,100% 100%,${fractureX - 7}% 100%)`];
        for (let shard = 0; shard < shapes.length; shard++) {
          const piece = document.createElement('span'); piece.className = 'stone-fragment';
          Object.assign(piece.style, { left: x + 'px', top: y + 'px', width: rect.width + 'px', height: rect.height + 'px', clipPath: shapes[shard] });
          piece.style.setProperty('--stone-profile', getComputedStyle(source).getPropertyValue('--stone-profile'));
          piece.innerHTML = `<span class="tile tile-piece">${fruit(tile)}</span>`;
          const targetX = bounds.width * (.05 + ((plan.seed + row * 67 + col * 131 + shard * 239) % 901) / 1000);
          const targetY = bounds.height * (.08 + ((plan.seed + row * 173 + col * 97 + shard * 313) % 701) / 1000);
          const dx = scattered ? targetX - x - rect.width / 2 : (shard % 2 ? 1 : -1) * (18 + (row * 7 + col * 3) % 24);
          const dy = scattered ? targetY - y - rect.height / 2 : 0;
          piece.dataset.scatter = String(scattered);
          piece.style.transformOrigin = `${shard % 2 ? 78 : 22}% ${shard < 2 ? 22 : 78}%`;
          this.layer.append(piece);
          const duration = scattered ? 1400 + shard * 70 : 960 + shard * 50;
          const acceleration = rect.height * (scattered ? 14 : 8);
          const velocity = dy + 35 - acceleration / 2;
          const spin = (shard % 2 ? 1 : -1) * (80 + (plan.seed + shard * 47 + row * 23 + col * 13) % 150);
          // Sample a ballistic arc: steady sideways speed, gravity, and no shrinking rock.
          const frames: Keyframe[] = Array.from({ length: 17 }, (_, index) => {
            const t = index / 16;
            return { transform: `translate(${dx * t}px,${velocity * t + acceleration * t * t / 2}px) rotate(${spin * t}deg)`, opacity: t <= .75 ? 1 : (1 - t) * 4, offset: t };
          });
          this.animate(piece, frames, duration, undefined, 0, 'linear');
        }
        for (let i = 0; i < 7; i++) {
          const dust = document.createElement('i'); dust.className = i % 2 ? 'stone-dust' : 'stone-spark';
          Object.assign(dust.style, { left: x + rect.width / 2 + 'px', top: y + rect.height / 2 + 'px' });
          this.layer.append(dust);
          const angle = (i / 7 + (row + col) * .13) * Math.PI * 2;
          const dx = Math.cos(angle) * (scattered ? bounds.width * .4 : 25 + i * 5), dy = Math.sin(angle) * (scattered ? bounds.height * .35 : 30);
          this.animate(dust, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: .9 }, { transform: `translate(${dx}px,${dy}px) scale(${i % 2 ? 2.8 : 1.2}) rotate(90deg)`, opacity: .7, offset: .45 }, { transform: `translate(${dx * 1.4}px,${dy + 40}px) scale(${i % 2 ? 4 : .4}) rotate(180deg)`, opacity: 0 }], 800 + i * 60);
        }
        for (let cloud = 0; cloud < (scattered ? 2 : 1); cloud++) {
          const dust = document.createElement('i'); dust.className = 'stone-dust-cloud';
          Object.assign(dust.style, { left: x + rect.width / 2 + 'px', top: y + rect.height / 2 + 'px', width: rect.width * 1.3 + 'px', height: rect.height + 'px' });
          this.layer.append(dust);
          const drift = (cloud ? 1 : -1) * bounds.width * (scattered ? .2 : .035);
          this.animate(dust, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: `translate(calc(-50% + ${drift * .3}px),-85%) scale(1.6)`, opacity: scattered ? .6 : .35, offset: .2 }, { transform: `translate(calc(-50% + ${drift}px),-160%) scale(${scattered ? 3.4 : 2})`, opacity: 0 }], scattered ? 1800 : 1000);
        }
      };
      const delay = score ? plan.cells.find(cell => cell.row === row && cell.col === col)!.delay : 0;
      if (delay) {
        const timer = setTimeout(() => { this.timers.delete(timer); emit(); }, delay); this.timers.add(timer);
      } else emit();
    }
    const flash = document.createElement('span'); flash.className = 'stone-shockwave';
    Object.assign(flash.style, { left: centerX / frame.matches.length + 'px', top: centerY / frame.matches.length + 'px', width: score ? '150px' : '80px', height: score ? '150px' : '80px' });
    this.layer.append(flash);
    this.animate(flash, [{ transform: 'translate(-50%,-50%) scale(.15)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(.7)', opacity: .65, offset: .25 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }], 600);
    const force = Math.min(4, 1.5 + frame.matches.length * .35);
    const shake = this.scene.animate([{ translate: '0 0' }, { translate: `${-force}px 1px` }, { translate: `${force}px -2px` }, { translate: `${-force * .6}px 1px` }, { translate: `${force * .4}px 0` }, { translate: '0 0' }], { duration: 280, easing: 'ease-out' });
    this.animations.add(shake);
    void shake.finished.catch(() => {}).finally(() => this.animations.delete(shake));
    if (!score) return;
    const popup = document.createElement('span'); popup.className = `score-popup ${own ? 'own-points' : 'opponent-points'}`;
    const factorValue = comboFactor(frame);
    popup.dataset.points = String(frame.points); popup.dataset.multiplier = String(factorValue);
    popup.style.left = Math.max(65, Math.min(bounds.width - 65, centerX / frame.matches.length)) + 'px';
    popup.style.top = Math.max(45, centerY / frame.matches.length - 8) + 'px';
    popup.innerHTML = `<strong>+${frame.points}</strong>${factorValue > 1 ? `<span class="combo-factor"><small>COMBO</small><b>×${factorValue}</b></span>` : ''}`;
    const delay = factorValue > 1 ? comboDelayMs(frame) : 0;
    const factor = popup.querySelector<HTMLElement>('.combo-factor');
    if (factor) factor.style.animationDelay = delay + 'ms';
    this.layer.append(popup);
    this.animate(popup, [{ transform: 'translate(-50%,-30%) scale(.65)', opacity: 0 }, { transform: 'translate(-50%,-60%) scale(1.15)', opacity: 1, offset: .18 }, { transform: 'translate(-50%,-85%) scale(1)', opacity: 1, offset: .65 }, { transform: 'translate(-50%,-150%) scale(.95)', opacity: 0 }], 2000, undefined, delay);
  }
  private animate(element: HTMLElement, frames: Keyframe[], duration: number, done?: () => void, delay = 0, easing = 'ease-out') {
    const animation = element.animate(frames, { duration, delay, fill: 'backwards', easing }); this.animations.add(animation);
    return animation.finished.then(() => done?.()).catch(() => {}).finally(() => { this.animations.delete(animation); element.remove(); });
  }
}
