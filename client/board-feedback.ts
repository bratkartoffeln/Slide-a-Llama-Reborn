import { fruit } from './art';
import type { Frame } from '../shared/game';

/** A bounded overlay keeps transient fragments and score labels out of the game grid. */
export class BoardFeedback {
  private animations = new Set<Animation>();
  constructor(private scene: HTMLElement, private layer: HTMLElement, private enabled: () => boolean) {}
  clear() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear(); this.layer.replaceChildren();
  }
  burst(frame: Frame, own: boolean) {
    if (!this.enabled() || !frame.matches.length) return;
    const bounds = this.scene.getBoundingClientRect();
    const shapes = ['polygon(0 0,50% 0,43% 48%,0 35%)', 'polygon(50% 0,100% 0,100% 42%,43% 48%)', 'polygon(0 35%,43% 48%,52% 100%,0 100%)', 'polygon(43% 48%,100% 42%,100% 100%,52% 100%)'];
    let centerX = 0, centerY = 0;
    for (const [row, col] of frame.matches) {
      const tile = frame.board[row][col];
      const source = this.scene.querySelector<HTMLElement>(`#board-controls [data-row="${row}"][data-col="${col}"]`);
      if (!tile || !source) continue;
      const rect = source.getBoundingClientRect(), x = rect.left - bounds.left, y = rect.top - bounds.top;
      centerX += x + rect.width / 2; centerY += y + rect.height / 2;
      for (let shard = 0; shard < shapes.length; shard++) {
        const piece = document.createElement('span'); piece.className = 'stone-fragment';
        Object.assign(piece.style, { left: x + 'px', top: y + 'px', width: rect.width + 'px', height: rect.height + 'px', clipPath: shapes[shard] });
        piece.style.setProperty('--stone-profile', getComputedStyle(source).getPropertyValue('--stone-profile'));
        piece.innerHTML = `<span class="tile tile-piece">${fruit(tile)}</span>`;
        const dx = (shard % 2 ? 1 : -1) * (18 + (row * 7 + col * 3) % 24);
        this.layer.append(piece);
        this.animate(piece, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx * .55}px,-14px) rotate(${dx}deg)`, opacity: 1, offset: .35 }, { transform: `translate(${dx}px,35px) rotate(${dx * 2}deg) scale(.65)`, opacity: 0 }], 480 + shard * 25);
      }
    }
    const popup = document.createElement('span'); popup.className = `score-popup ${own ? 'own-points' : 'opponent-points'}`;
    popup.dataset.points = String(frame.points); popup.dataset.multiplier = String(frame.multiplier);
    popup.style.left = Math.max(65, Math.min(bounds.width - 65, centerX / frame.matches.length)) + 'px';
    popup.style.top = Math.max(45, centerY / frame.matches.length - 8) + 'px';
    popup.innerHTML = `<strong>+${frame.points}</strong>${frame.multiplier > 1 ? `<small>KASKADE ×${frame.multiplier}</small>` : ''}`;
    this.layer.append(popup);
    this.animate(popup, [{ transform: 'translate(-50%,-30%) scale(.65)', opacity: 0 }, { transform: 'translate(-50%,-60%) scale(1.15)', opacity: 1, offset: .18 }, { transform: 'translate(-50%,-85%) scale(1)', opacity: 1, offset: .65 }, { transform: 'translate(-50%,-150%) scale(.95)', opacity: 0 }], 1000);
  }
  private animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = element.animate(frames, { duration, easing: 'ease-out' }); this.animations.add(animation);
    void animation.finished.catch(() => {}).finally(() => { this.animations.delete(animation); element.remove(); });
  }
}
