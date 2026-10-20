import { isNativeApp } from './server-config';

export async function copyText(text: string) {
  if (isNativeApp()) {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
  } else await navigator.clipboard.writeText(text);
}

export async function installNativeApp(onBack: () => Promise<void>, onActive: (active: boolean) => void) {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  let nativeActive = true;
  const update = () => {
    const active = nativeActive && !document.hidden;
    document.documentElement.dataset.appActive = String(active);
    onActive(active);
  };
  document.addEventListener('visibilitychange', update);
  await App.addListener('appStateChange', ({ isActive }) => { nativeActive = isActive; update(); });
  await App.addListener('backButton', () => { void onBack(); });
}

export async function minimizeNativeApp() {
  const { App } = await import('@capacitor/app');
  await App.minimizeApp();
}
