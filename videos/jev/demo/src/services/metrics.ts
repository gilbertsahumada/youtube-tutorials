import type { BatchSummary, RunRecord } from '../domain/types.ts';

export function summarize(records: RunRecord[], wallMs: number): BatchSummary {
  const successes = records.filter(record => record.error === null && record.result !== null);
  const times = successes.map(record => record.elapsedMs).sort((a, b) => a - b);
  const percentile = (p: number) => times[Math.max(0, Math.ceil(times.length * p) - 1)];
  return {
    total: records.length, successes: successes.length, failures: records.length - successes.length,
    httpAttempts: records.reduce((sum, record) => sum + record.attempts.length, 0),
    retries: records.reduce((sum, record) => sum + Math.max(0, record.attempts.length - 1), 0),
    wallMs, successfulReportsPerSecond: wallMs > 0 ? successes.length / (wallMs / 1000) : 0,
    latencyMs: times.length ? {
      min: times[0], p50: percentile(0.5), p95: percentile(0.95), max: times.at(-1)!,
      mean: times.reduce((sum, time) => sum + time, 0) / times.length,
    } : null,
    models: [...new Set(successes.map(record => record.result!.model))],
    inputTokens: successes.reduce((sum, record) => sum + (record.result?.usage?.input_tokens ?? 0), 0),
    outputTokens: successes.reduce((sum, record) => sum + (record.result?.usage?.output_tokens ?? 0), 0),
  };
}
