import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.bratkartoffeln.slideallama',
  appName: 'Slide-a-Llama',
  webDir: 'dist/android',
  backgroundColor: '#244c40',
  server: { hostname: 'localhost', androidScheme: 'https', cleartext: false, errorPath: 'unsupported-webview.html' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false, minWebViewVersion: 107 },
  plugins: { SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK', hidden: false } },
};
export default config;
