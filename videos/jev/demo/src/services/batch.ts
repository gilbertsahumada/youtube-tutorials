import type { BatchSummary, Report, RunRecord } from '../domain/types.ts';
import { summarize } from './metrics.ts';

export interface Progress { completed: number; total: number; failures: number; elapsedMs: number }

export async function runBatch(
  reports: Report[], concurrency: number,
  process: (report: Report) => Promise<RunRecord>,
  onProgress: (progress: Progress) => void = () => {},
): Promise<{ records: RunRecord[]; summary: BatchSummary }> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error('La concurrencia debe ser un entero entre 1 y 32.');
  }
  const records: RunRecord[] = new Array(reports.length);
  let next = 0;
  let completed = 0;
  let failures = 0;
  const started = performance.now();
  async function worker() {
    while (next < reports.length) {
      const index = next++;
      records[index] = await process(reports[index]);
      if (records[index].error) failures++;
      completed++;
      onProgress({ completed, total: reports.length, failures, elapsedMs: performance.now() - started });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, reports.length) }, () => worker()));
  return { records, summary: summarize(records, performance.now() - started) };
}
