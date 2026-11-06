import { setTimeout as sleep } from 'node:timers/promises';
import { ENDPOINT } from '../config.ts';
import type { Attempt, JevRequest } from '../domain/types.ts';

export interface ClientReply { raw: unknown; attempts: Attempt[]; error: string | null }
export interface JevClient { evaluate(request: JevRequest): Promise<ClientReply> }
interface Options {
  apiKey: string;
  fetchImpl?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxRetries?: number;
}

export function createJevClient({ apiKey, fetchImpl = fetch, wait = sleep, timeoutMs = 30_000, maxRetries = 2 }: Options): JevClient {
  if (!apiKey.trim()) throw new Error('Configura TYPESAFE_API_KEY en .env antes de enviar reportes.');
  return {
    async evaluate(request) {
      const attempts: Attempt[] = [];
      for (let index = 0; ; index++) {
        const started = performance.now();
        let response: Response;
        try {
          response = await fetchImpl(ENDPOINT, {
            method: 'POST', redirect: 'error',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(request), signal: AbortSignal.timeout(timeoutMs),
          });
        } catch (error) {
          attempts.push({ status: null, elapsedMs: performance.now() - started, retryDelayMs: 0 });
          return { raw: null, attempts, error: (error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError'
            ? 'La solicitud agotó el tiempo de espera.' : 'No se pudo conectar con TypeSafe.' };
        }
        const attempt: Attempt = { status: response.status, elapsedMs: 0, retryDelayMs: 0 };
        attempts.push(attempt);
        if (response.ok) {
          try {
            const raw: unknown = await response.json();
            attempt.elapsedMs = performance.now() - started;
            return { raw, attempts, error: null };
          } catch {
            attempt.elapsedMs = performance.now() - started;
            return { raw: null, attempts, error: 'La respuesta no es JSON válido o no terminó de recibirse.' };
          }
        }
        const retryAfter = response.headers.get('retry-after');
        const retryMs = retryAfter === null ? 0 : Number.isFinite(Number(retryAfter))
          ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
        // Liberar el cuerpo sin guardar textos del proveedor que puedan contener datos sensibles.
        await response.body?.cancel();
        attempt.elapsedMs = performance.now() - started;
        if ([429, 529].includes(response.status) && index < maxRetries && !(retryMs > 30_000)) {
          attempt.retryDelayMs = Math.max(500 * 2 ** index, Number.isFinite(retryMs) ? retryMs : 0);
          await wait(attempt.retryDelayMs);
          continue;
        }
        return { raw: null, attempts, error: `TypeSafe HTTP ${response.status}. El reporte queda para revisión manual.` };
      }
    },
  };
}
