import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadDataset } from '../src/infra/datasets.ts';
import { buildRequest } from '../src/domain/request.ts';
import { createJevClient } from '../src/infra/jev-client.ts';
import { processReport } from '../src/services/process-report.ts';
import { runBatch } from '../src/services/batch.ts';
import { summarize } from '../src/services/metrics.ts';
import { saveRun } from '../src/infra/run-store.ts';
import type { JevRequest, JevResult, RunRecord } from '../src/domain/types.ts';

// Datos controlados: verifican el programa, no el rendimiento ni la calidad de Jev.
function answer(request: JevRequest): JevResult {
  return {
    model: request.model,
    answers: {
      ruta: { type: 'choice', choice: 'investigar_fallo', confidence: 0.6,
        probabilities: { investigar_fallo: 0.8, pedir_informacion: 0.2 } },
      ...(request.questions.impacto ? { impacto: {
        type: 'score' as const, score: 1.25, confidence: 0.625, probabilities: { '0': 0, '1': 0.75, '2': 0.25 },
      } } : {}),
    },
    usage: { input_tokens: 120, output_tokens: 20 },
  };
}

const model = 'jev-1.14.0';
const report = { id: 'test', message: 'No puedo entrar', context: 'Producción. Más reportes desde un despliegue.' };
const validClient = { async evaluate(request: JevRequest) {
  return { raw: answer(request), attempts: [{ status: 200, elapsedMs: 10, retryDelayMs: 0 }], error: null };
} };

test('datasets: 3 casos manuales y 100 reportes distintos con IDs únicos', async () => {
  const manual = await loadDataset('manual');
  const batch = await loadDataset('batch-100');
  assert.equal(manual.length, 3);
  assert.deepEqual(manual.map(item => item.id), ['1', '2', '3']);
  assert.equal(batch.length, 100);
  assert.equal(new Set(batch.map(item => item.id)).size, 100);
  assert.equal(new Set(batch.map(item => item.message)).size, 100);
  for (const impact of [false, true]) {
    const a = buildRequest(manual[0], model, impact);
    const b = buildRequest(manual[1], model, impact);
    assert.notEqual(a.state.contexto, b.state.contexto);
    assert.deepEqual({ ...a, state: { ...a.state, contexto: '' } }, { ...b, state: { ...b.state, contexto: '' } });
    assert.equal(Object.hasOwn(a.questions, 'impacto'), impact);
  }
});

test('cliente envía el contrato HTTP correcto sin guardar autorización', async () => {
  const request = buildRequest(report, model, true);
  const client = createJevClient({ apiKey: 'test-key', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-key');
    assert.equal(init?.redirect, 'error');
    assert.deepEqual(JSON.parse(init?.body as string), request);
    return Response.json(answer(request));
  } });
  const record = await processReport(report, model, true, client);
  assert.equal(record.error, null);
  assert.equal(record.destination, 'pendiente_de_investigacion');
  assert.equal(record.result?.answers.impacto?.score, 1.25);
  assert.equal(JSON.stringify(record).includes('test-key'), false);
});

test('429 y 529 respetan backoff y quedan incluidos en el registro de intentos', async () => {
  const request = buildRequest(report, model, false);
  const waits: number[] = [];
  let calls = 0;
  const client = createJevClient({
    apiKey: 'test', wait: async ms => { waits.push(ms); },
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response(null, { status: 429, headers: { 'retry-after': '0.7' } });
      if (calls === 2) return new Response(null, { status: 529 });
      return Response.json(answer(request));
    },
  });
  const reply = await client.evaluate(request);
  assert.deepEqual(waits, [700, 1000]);
  assert.deepEqual(reply.attempts.map(item => item.status), [429, 529, 200]);
  assert.equal(reply.error, null);
});

test('reintentos tienen límite y no ignoran Retry-After largo', async () => {
  let calls = 0;
  const request = buildRequest(report, model, false);
  const client = createJevClient({ apiKey: 'test', wait: async () => {}, fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 429 });
  } });
  assert.equal((await client.evaluate(request)).attempts.length, 3);
  assert.equal(calls, 3);
  const noRetry = createJevClient({ apiKey: 'test', wait: async () => assert.fail('No esperar'),
    fetchImpl: async () => new Response(null, { status: 429, headers: { 'retry-after': '60' } }),
  });
  assert.equal((await noRetry.evaluate(request)).attempts.length, 1);
});

test('errores de HTTP, red, timeout y JSON terminan en revisión manual', async () => {
  const providers: typeof fetch[] = [
    async () => new Response('private-provider-text', { status: 401 }),
    async () => { throw new TypeError('private-network-text'); },
    async () => { throw new DOMException('timeout', 'TimeoutError'); },
    async () => new Response('not json'),
  ];
  for (const fetchImpl of providers) {
    const record = await processReport(report, model, false, createJevClient({ apiKey: 'test-key', fetchImpl }));
    assert.ok(record.error);
    assert.equal(record.destination, 'revision_manual');
    assert.equal(JSON.stringify(record).includes('private-'), false);
    assert.equal(JSON.stringify(record).includes('test-key'), false);
    assert.equal(record.attempts.length, 1);
  }
});

test('esquemas inválidos conservan la respuesta cruda pero no aplican una ruta', async () => {
  const request = buildRequest(report, model, true);
  for (const mutate of [
    (value: JevResult) => { delete value.answers.impacto; },
    (value: JevResult) => { value.answers.impacto!.score = 3; },
    (value: JevResult) => { value.answers.ruta.probabilities.pedir_informacion = 0.8; },
  ]) {
    const raw = answer(request);
    mutate(raw);
    const record = await processReport(report, model, true, { async evaluate() {
      return { raw, attempts: [], error: null };
    } });
    assert.equal(record.destination, 'revision_manual');
    assert.ok(record.error);
    assert.equal(record.result, null);
    assert.deepEqual(record.rawResult, raw);
  }
});

test('lote procesa los 100 exactamente una vez, limita concurrencia y conserva errores', async () => {
  const reports = await loadDataset('batch-100');
  let active = 0;
  let peak = 0;
  const seen = new Set<string>();
  const progress: number[] = [];
  const { records, summary } = await runBatch(reports, 8, async item => {
    active++;
    peak = Math.max(peak, active);
    assert.equal(seen.has(item.id), false);
    seen.add(item.id);
    await setImmediate();
    const record = await processReport(item, model, false, validClient);
    if (item.id === 'batch-050') { record.error = 'Error controlado'; record.result = null; record.destination = 'revision_manual'; }
    active--;
    return record;
  }, state => progress.push(state.completed));
  assert.equal(peak, 8);
  assert.equal(seen.size, 100);
  assert.deepEqual(records.map(item => item.report.id), reports.map(item => item.id));
  assert.equal(progress.at(-1), 100);
  assert.equal(summary.successes, 99);
  assert.equal(summary.failures, 1);
  assert.equal(records[49].destination, 'revision_manual');
  await assert.rejects(() => runBatch(reports, 0, async () => records[0]));
});

test('excepción inesperada del cliente también conserva el reporte para revisión', async () => {
  const record = await processReport(report, model, false, { async evaluate() { throw new Error('private-details'); } });
  assert.equal(record.destination, 'revision_manual');
  assert.equal(record.report.message, report.message);
  assert.equal(JSON.stringify(record).includes('private-details'), false);
});

test('métricas: throughput solo de éxitos, percentiles sin errores ni tiempo de cola', async () => {
  const base = await processReport(report, model, false, validClient);
  const records: RunRecord[] = [10, 20, 30, 40].map(elapsedMs => ({ ...base, elapsedMs }));
  records.push({ ...base, result: null, error: 'HTTP 429', elapsedMs: 1000,
    attempts: [{ status: 429, elapsedMs: 1000, retryDelayMs: 0 }] });
  const metrics = summarize(records, 2000);
  assert.equal(metrics.successfulReportsPerSecond, 2);
  assert.equal(metrics.failures, 1);
  assert.deepEqual(metrics.latencyMs, { min: 10, p50: 20, p95: 40, max: 40, mean: 25 });
  assert.equal(metrics.inputTokens, 480);
  assert.equal(summarize([records[4]], 1000).latencyMs, null);
  assert.equal(summarize([], 0).successfulReportsPerSecond, 0);
});

test('registro durable incluye entradas, errores, métricas e intentos y no colisiona', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'jev-ts-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const record = await processReport(report, model, false, validClient);
  const directory = pathToFileURL(dir + '/');
  const summary = summarize([record], 100);
  const a = await saveRun([record], summary, 1, directory);
  const b = await saveRun([record], summary, 1, directory);
  assert.notEqual(a, b);
  const raw = await readFile(a, 'utf8');
  const saved = JSON.parse(raw);
  assert.equal(saved.records[0].request.state.mensaje, report.message);
  assert.equal(saved.summary.successes, 1);
  assert.equal(saved.records[0].attempts[0].status, 200);
  assert.equal(raw.includes('Authorization'), false);
});

test('CLI: inspección sin clave y opciones inválidas sin enviar solicitudes', () => {
  const cwd = new URL('../', import.meta.url);
  for (const args of [['ver', '1'], ['preguntas'], ['datos']]) {
    const result = spawnSync(process.execPath, ['src/index.ts', ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.length > 0);
    assert.doesNotMatch(result.stdout, /RESUMEN DE ESTA EJECUCIÓN/);
  }
  const invalid = spawnSync(process.execPath, ['src/index.ts', 'lote', '100', '0'], { cwd, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Concurrencia/);
  assert.throws(() => createJevClient({ apiKey: '' }), /TYPESAFE_API_KEY/);
});
