export const DEFAULT_MODEL = 'jev-1.14.0';
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export function loadConfig() {
  try { process.loadEnvFile(new URL('../.env', import.meta.url)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('No se pudo leer .env.');
  }
  return { model: process.env.JEV_MODEL || DEFAULT_MODEL, apiKey: process.env.TYPESAFE_API_KEY || '' };
}
