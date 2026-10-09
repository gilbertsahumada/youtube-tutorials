import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const privatePath = name => resolve(ROOT, '.private', name);
export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function saveJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, path);
}
export function loadEnv() {
  try { process.loadEnvFile(resolve(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
