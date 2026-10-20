import { SystemBars } from '@capacitor/core';
import { isNativeApp } from './server-config';

/** Resize the actual layout, keeping pointer coordinates and particle effects in CSS pixels. */
export function installFullscreen(arena: HTMLElement, toggle: HTMLButtonElement) {
  const toolbar = document.createElement('div');
  toolbar.className = 'fullscreen-toolbar'; toolbar.hidden = true;
  toolbar.innerHTML = '<span>Slide-a-Llama</span><button id="fullscreen-close" class="button secondary" aria-label="Vollbild beenden">Vollbild beenden ⤡</button>';
  document.body.append(toolbar);
  const close = toolbar.querySelector<HTMLButtonElement>('button')!;
  let active = false, busy = false, frame = 0, savedScroll = 0;
  const inertElements: HTMLElement[] = [];

  function fit() {
    frame = 0;
    if (!active) return;
    const style = getComputedStyle(arena);
    const width = innerWidth - parseFloat(style.left) - parseFloat(style.right);
    const height = innerHeight - parseFloat(style.top) - parseFloat(style.bottom);
    let low = 120, high = Math.max(low, width);
    // Find the largest arena width whose natural height fits the viewport.
    for (let i = 0; i < 12; i++) {
      const candidate = (low + high) / 2;
      arena.style.width = candidate + 'px';
      if (arena.getBoundingClientRect().height <= height) low = candidate; else high = candidate;
    }
    arena.style.width = Math.floor(low) + 'px';
  }
  function scheduleFit() { if (active && !frame) frame = requestAnimationFrame(fit); }
  function show(value: boolean) {
    if (active === value) return;
    active = value;
    document.body.classList.toggle('game-fullscreen', active);
    toolbar.hidden = !active;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.setAttribute('aria-label', active ? 'Vollbild beenden' : 'Spielfeld im Vollbild maximieren');
    if (active) {
      savedScroll = scrollY;
      // Keep the arena and its result dialog interactive; exclude the covered page from tab order.
      for (let node: HTMLElement = arena; node.parentElement && node !== document.body; node = node.parentElement) {
        for (const sibling of node.parentElement.children) if (sibling !== node && sibling !== toolbar && sibling instanceof HTMLElement && !sibling.inert && !sibling.matches('dialog, #toast')) {
          sibling.inert = true; inertElements.push(sibling);
        }
      }
      fit(); close.focus({ preventScroll: true });
    } else {
      for (const element of inertElements.splice(0)) element.inert = false;
      arena.style.removeProperty('width');
      scrollTo(0, savedScroll); toggle.focus({ preventScroll: true });
    }
  }
  async function exit() {
    if (busy || !active) return;
    busy = true;
    try {
      if (isNativeApp()) await SystemBars.show();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* Always leave the maximized layout even if the system API rejects the request. */ }
    finally { show(false); busy = false; }
  }
  toggle.onclick = async () => {
    if (busy) return;
    if (active) { await exit(); return; }
    busy = true;
    try {
      if (isNativeApp()) await SystemBars.hide();
      else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
    } catch { /* The maximized layout also works when browser fullscreen is unavailable. */ }
    finally { show(true); busy = false; }
  };
  close.onclick = () => { void exit(); };
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) show(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && active && !document.querySelector('dialog[open]')) { event.preventDefault(); void exit(); } });
  window.addEventListener('resize', scheduleFit);
  window.visualViewport?.addEventListener('resize', scheduleFit);
  new ResizeObserver(scheduleFit).observe(arena);
  new MutationObserver(scheduleFit).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  return { get active() { return active; }, exit };
}
