import { buildRequest } from '../domain/request.ts';
import { validateResult } from '../domain/validation.ts';
import { applyPolicy } from '../domain/policy.ts';
import type { Report, RunRecord } from '../domain/types.ts';
import type { JevClient } from '../infra/jev-client.ts';

export async function processReport(report: Report, model: string, impact: boolean, client: JevClient): Promise<RunRecord> {
  const request = buildRequest(report, model, impact);
  const record: RunRecord = {
    report, request, rawResult: null, result: null,
    destination: 'revision_manual', error: null, elapsedMs: 0, attempts: [],
  };
  const started = performance.now();
  let reply;
  try { reply = await client.evaluate(request); }
  catch {
    record.error = 'No se pudo completar la solicitud al proveedor.';
    record.elapsedMs = performance.now() - started;
    return record;
  }
  record.attempts = reply.attempts;
  record.rawResult = reply.raw;
  record.error = reply.error;
  if (!reply.error) {
    try {
      record.result = validateResult(reply.raw, request);
      record.destination = applyPolicy(record.result);
    } catch (error) { record.error = (error as Error).message; }
  }
  record.elapsedMs = performance.now() - started;
  return record;
}
