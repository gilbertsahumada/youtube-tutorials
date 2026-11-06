import { readFile } from 'node:fs/promises';
import type { Report } from '../domain/types.ts';

export async function loadDataset(name: 'manual' | 'batch-100'): Promise<Report[]> {
  const raw: unknown = JSON.parse(await readFile(new URL(`../../data/${name}.json`, import.meta.url), 'utf8'));
  if (!Array.isArray(raw) || !raw.every(item => item && typeof item.id === 'string'
      && typeof item.message === 'string' && item.message.trim()
      && typeof item.context === 'string' && item.context.trim())
      || new Set(raw.map(item => item.id)).size !== raw.length) {
    throw new Error(`Dataset ${name} inválido: revisa IDs, mensajes y contextos.`);
  }
  if (name === 'batch-100' && raw.length !== 100) throw new Error('El lote debe contener exactamente 100 reportes.');
  return raw as Report[];
}
