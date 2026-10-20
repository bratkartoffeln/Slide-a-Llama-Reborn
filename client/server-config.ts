import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();
export const DEFAULT_NATIVE_SERVER = 'https://flusensieb.dns.navy:9443';
const SETTING = 'lama:android:server';

export function normalizeServer(input: string): string {
  const value = input.trim();
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Bitte eine vollständige HTTPS-Serveradresse eingeben.'); }
  if (!/^https:\/\/[^/?#\\\s@]+\/?$/i.test(value) || url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost')) {
    throw new Error('Der Spielserver muss eine HTTPS-Adresse mit Hostname und optionalem Port sein, ohne Pfad oder Zugangsdaten.');
  }
  return url.origin;
}

export function serverEndpoint(): string {
  if (!isNativeApp()) return location.origin;
  try { const saved = localStorage.getItem(SETTING); if (saved) return normalizeServer(saved); } catch { /* Use the build default. */ }
  return normalizeServer(import.meta.env?.VITE_SERVER_URL || DEFAULT_NATIVE_SERVER);
}

export function saveServer(value: string): string {
  const endpoint = normalizeServer(value);
  localStorage.setItem(SETTING, endpoint);
  return endpoint;
}

export function sessionKey(room: string, endpoint = serverEndpoint(), native = isNativeApp()): string {
  return native ? `lama:session:${endpoint}:${room}` : `lama:session:${room}`;
}

export function invitationUrl(room: string): string {
  const url = new URL(isNativeApp() ? serverEndpoint() + '/' : location.href);
  url.searchParams.set('room', room); url.hash = '';
  return url.href;
}

export function validateInvitation(input: string): void {
  if (!isNativeApp() || /^[a-f\d]{8}$/i.test(input.trim())) return;
  const url = new URL(input.trim());
  if (url.origin !== serverEndpoint() || url.username || url.password) {
    throw new Error('Diese Einladung gehört zu einem anderen Spielserver. Stelle dessen HTTPS-Adresse zuerst unter Spielserver ein.');
  }
}
