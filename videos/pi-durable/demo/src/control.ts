import net from 'node:net';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type Request = { command: string; text?: string };
type Response = { ok: boolean; result?: unknown; error?: string };
// Short Unix socket paths also work when the repository path is long.
export function socketPath(directory: string) {
  return path.join(tmpdir(), `pi-durable-${createHash('sha256').update(directory).digest('hex').slice(0, 20)}.sock`);
}

export async function request(directory: string, input: Request): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath(directory));
    let buffer = '';
    socket.setTimeout(120_000, () => socket.destroy(new Error('La aplicación no respondió en 120 segundos')));
    socket.once('connect', () => socket.write(JSON.stringify(input) + '\n'));
    socket.on('data', data => {
      buffer += data.toString();
      if (!buffer.includes('\n')) return;
      try {
        const response = JSON.parse(buffer.slice(0, buffer.indexOf('\n'))) as Response;
        socket.end(); if (response.ok) resolve(response.result); else reject(new Error(response.error));
      } catch (error) { socket.destroy(); reject(error); }
    });
    socket.once('error', reject);
    socket.once('end', () => { if (!buffer.includes('\n')) reject(new Error('La aplicación cerró la conexión sin responder')); });
  });
}

export async function listen(directory: string, handle: (input: Request) => Promise<unknown>) {
  const address = socketPath(directory);
  // Only ECONNREFUSED identifies a stale Unix socket. A timeout or EACCES must
  // never authorize unlinking another live application's listener.
  const alive = await new Promise<boolean>((resolve, reject) => {
    const socket = net.createConnection(address);
    socket.setTimeout(2000, () => socket.destroy(new Error('El socket existente no responde')));
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') resolve(false);
      else if (e.code === 'ECONNREFUSED') fs.unlink(address).then(() => resolve(false), reject);
      else reject(e);
    });
  });
  if (alive) throw new Error('Esta sesión ya tiene un proceso activo. Usa demo:status, demo:crash o demo:stop.');
  const server = net.createServer(socket => {
    let buffer = ''; let handled = false;
    socket.on('error', () => {});
    socket.on('data', async data => {
      if (handled) return;
      buffer += data.toString();
      if (buffer.length > 64_000) { socket.destroy(); return; }
      if (!buffer.includes('\n')) return;
      handled = true;
      try {
        const result = await handle(JSON.parse(buffer.slice(0, buffer.indexOf('\n'))) as Request);
        socket.end(JSON.stringify({ ok: true, result }) + '\n');
      } catch (error) {
        socket.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + '\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(address, () => { server.off('error', reject); resolve(); }); });
  await fs.chmod(address, 0o600);
  return server;
}
