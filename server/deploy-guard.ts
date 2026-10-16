import type { IncomingMessage, ServerResponse } from 'node:http';

export function localDeploymentRequest(address: string | undefined) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export class DeploymentGuard {
  private until = 0;
  constructor(private roomCount: () => number, private now = Date.now) {}
  get active() { return this.until > this.now(); }
  handle(req: IncomingMessage, res: ServerResponse) {
    let path: string;
    try { path = new URL(req.url ?? '/', 'http://localhost').pathname; }
    catch { return false; }
    if (!['/internal/deploy-status', '/internal/maintenance/enter', '/internal/maintenance/exit'].includes(path)) return false;
    const reply = (code: number) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ roomCount: this.roomCount(), maintenance: this.active }));
    };
    if (!localDeploymentRequest(req.socket.remoteAddress)) { reply(403); return true; }
    if (path === '/internal/deploy-status') { reply(req.method === 'GET' ? 200 : 405); return true; }
    if (req.method !== 'POST') { reply(405); return true; }
    if (path.endsWith('/enter')) {
      if (this.roomCount() !== 0) { reply(409); return true; }
      this.until = this.now() + 300_000;
    } else this.until = 0;
    reply(200); return true;
  }
}
