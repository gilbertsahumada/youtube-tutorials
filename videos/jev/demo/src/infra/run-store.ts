import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { BatchSummary, RunRecord } from '../domain/types.ts';

export async function saveRun(records: RunRecord[], summary: BatchSummary, concurrency: number, directory = new URL('../../runs/', import.meta.url)): Promise<string> {
  await mkdir(directory, { recursive: true });
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  const path = new URL(`${id}.json`, directory);
  await writeFile(path, JSON.stringify({
    id, source: 'typesafe-api', concurrency,
    timing: 'Tiempo de pared de procesamiento: incluye red, reintentos, validación y progreso; excluye escritura de este archivo. Latencias de solicitudes exitosas, sin espera en cola.',
    summary, records,
  }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return fileURLToPath(path);
}
