import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { checkOnline } from './check-online.mjs';
const suffix = randomBytes(5).toString('hex');
const image = `slide-a-lama-check:${suffix}`, container = `slide-a-lama-check-${suffix}`;
function docker(args, capture = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', timeout: 600_000 });
  if (result.error || result.status !== 0) throw new Error(`docker ${args[0]} fehlgeschlagen: ${result.error?.message ?? result.stderr ?? result.status}`);
  return result.stdout?.trim();
}
docker(['info'], true);
let built = false, started = false;
try {
  docker(['compose', '-p', `slide-a-lama-check-${suffix}`, '-f', 'compose.yaml', 'config', '--quiet']);
  docker(['build', '-t', image, '.']); built = true;
  docker(['run', '--detach', '--name', container, '-p', '127.0.0.1::2568', image], true); started = true;
  const port = docker(['port', container, '2568/tcp'], true).split(':').at(-1);
  const url = `http://127.0.0.1:${port}`;
  const until = Date.now() + 30_000; let ready = false;
  while (Date.now() < until) {
    try { ready = (await fetch(url + '/ready', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break; await new Promise(r => setTimeout(r, 300));
  }
  if (!ready) throw new Error('Container wurde nicht bereit.');
  await checkOnline(url);
} finally {
  if (started) docker(['rm', '-f', container], true);
  if (built) docker(['image', 'rm', image], true);
}
