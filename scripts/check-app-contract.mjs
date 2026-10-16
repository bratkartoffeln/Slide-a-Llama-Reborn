import { readFileSync, existsSync } from 'node:fs';
const missing = [];
let pkg;
try { pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))); }
catch { missing.push('package.json (valid JSON)'); }
if (!existsSync(new URL('../package-lock.json', import.meta.url))) missing.push('package-lock.json');
for (const script of ['build', 'start', 'test']) {
  if (!pkg?.scripts?.[script]) missing.push(`package.json scripts.${script}`);
}
if (missing.length) {
  console.error('NAS build is not ready. Missing application prerequisites:\n- ' + missing.join('\n- '));
  process.exit(1);
}
console.log('Package prerequisites present. Runtime contract: dist/, production npm start, HOST/PORT, HTTP /ready.');
