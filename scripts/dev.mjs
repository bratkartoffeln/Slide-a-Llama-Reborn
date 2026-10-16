import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--watch', '--import', 'tsx', 'server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' })
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(c => c.kill()); setTimeout(() => process.exit(code), 200); }
for (const child of children) child.on('exit', code => stop(code ?? 0));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
