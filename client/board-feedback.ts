import { fruit } from './art';
import type { Board, Frame, Move } from '../shared/game';
import { FEEDBACK_TIMING } from '../shared/feedback';

/** A bounded overlay keeps transient fragments and score labels out of the game grid. */
export class BoardFeedback {
  private animations = new Set<Animation>();
  constructor(private scene: HTMLElement, private layer: HTMLElement, private enabled: () => boolean) {}
  clear() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear(); this.layer.replaceChildren();
  }
  eject(board: Board, move: Move) {
    if (!this.enabled()) return;
    const { side, lane } = move;
    const full = side === 'top' ? board.every(row => row[lane] !== null) : board[lane].every(cell => cell !== null);
    if (!full) return;
    const row = side === 'top' ? 4 : lane, col = side === 'top' ? lane : side === 'left' ? 4 : 0;
    const source = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="${row}"][data-col="${col}"]`)!;
    const bounds = this.scene.getBoundingClientRect(), rect = source.getBoundingClientRect();
    const piece = document.createElement('span'); piece.className = 'ejected-stone';
    Object.assign(piece.style, { left: rect.left - bounds.left + 'px', top: rect.top - bounds.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    piece.innerHTML = source.outerHTML;
    this.layer.append(piece);
    const dx = side === 'top' ? 0 : (side === 'left' ? 1 : -1) * rect.width;
    const frames = side === 'top' ? [{ transform: 'scale(1)' }, { transform: 'scale(1.15,.3)', offset: .85 }, { transform: 'scale(1.2,.05)' }] : [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px) rotate(${dx > 0 ? 12 : -12}deg)` }];
    this.animate(piece, frames, FEEDBACK_TIMING.insert, () => this.burst({ board, matches: [[row, col]], points: 0, multiplier: 1 }, true, false, dx));
  }
  burst(frame: Frame, own: boolean, score = true, offsetX = 0) {
    if (!this.enabled() || !frame.matches.length) return;
    const bounds = this.scene.getBoundingClientRect();
    const shapes = ['polygon(0 0,50% 0,43% 48%,0 35%)', 'polygon(50% 0,100% 0,100% 42%,43% 48%)', 'polygon(0 35%,43% 48%,52% 100%,0 100%)', 'polygon(43% 48%,100% 42%,100% 100%,52% 100%)'];
    let centerX = 0, centerY = 0;
    for (const [row, col] of frame.matches) {
      const tile = frame.board[row][col];
      const source = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="${row}"][data-col="${col}"]`);
      if (!tile || !source) continue;
      const rect = source.getBoundingClientRect(), x = rect.left - bounds.left + offsetX, y = rect.top - bounds.top;
      centerX += x + rect.width / 2; centerY += y + rect.height / 2;
      for (let shard = 0; shard < shapes.length; shard++) {
        const piece = document.createElement('span'); piece.className = 'stone-fragment';
        Object.assign(piece.style, { left: x + 'px', top: y + 'px', width: rect.width + 'px', height: rect.height + 'px', clipPath: shapes[shard] });
        piece.style.setProperty('--stone-profile', getComputedStyle(source).getPropertyValue('--stone-profile'));
        piece.innerHTML = `<span class="tile tile-piece">${fruit(tile)}</span>`;
        const dx = (shard % 2 ? 1 : -1) * (18 + (row * 7 + col * 3) % 24);
        this.layer.append(piece);
        this.animate(piece, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx * .55}px,-14px) rotate(${dx}deg)`, opacity: 1, offset: .35 }, { transform: `translate(${dx}px,35px) rotate(${dx * 2}deg) scale(.65)`, opacity: 0 }], 960 + shard * 50);
      }
      for (let i = 0; i < 7; i++) {
        const dust = document.createElement('i'); dust.className = i % 2 ? 'stone-dust' : 'stone-spark';
        Object.assign(dust.style, { left: x + rect.width / 2 + 'px', top: y + rect.height / 2 + 'px' });
        this.layer.append(dust);
        const angle = (i / 7 + (row + col) * .13) * Math.PI * 2;
        const dx = Math.cos(angle) * (25 + i * 5), dy = Math.sin(angle) * 30;
        this.animate(dust, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: .9 }, { transform: `translate(${dx}px,${dy}px) scale(${i % 2 ? 2.8 : 1.2}) rotate(90deg)`, opacity: .7, offset: .45 }, { transform: `translate(${dx * 1.4}px,${dy + 40}px) scale(${i % 2 ? 4 : .4}) rotate(180deg)`, opacity: 0 }], 800 + i * 60);
      }
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
    popup.dataset.points = String(frame.points); popup.dataset.multiplier = String(frame.multiplier);
    popup.style.left = Math.max(65, Math.min(bounds.width - 65, centerX / frame.matches.length)) + 'px';
    popup.style.top = Math.max(45, centerY / frame.matches.length - 8) + 'px';
    popup.innerHTML = `<strong>+${frame.points}</strong>${frame.multiplier > 1 ? `<small>KASKADE ×${frame.multiplier}</small>` : ''}`;
    this.layer.append(popup);
    this.animate(popup, [{ transform: 'translate(-50%,-30%) scale(.65)', opacity: 0 }, { transform: 'translate(-50%,-60%) scale(1.15)', opacity: 1, offset: .18 }, { transform: 'translate(-50%,-85%) scale(1)', opacity: 1, offset: .65 }, { transform: 'translate(-50%,-150%) scale(.95)', opacity: 0 }], 2000);
  }
  private animate(element: HTMLElement, frames: Keyframe[], duration: number, done?: () => void) {
    const animation = element.animate(frames, { duration, easing: 'ease-out' }); this.animations.add(animation);
    void animation.finished.then(() => done?.()).catch(() => {}).finally(() => { this.animations.delete(animation); element.remove(); });
  }
}
