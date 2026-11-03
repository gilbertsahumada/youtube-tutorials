import { setTimeout as sleep } from 'node:timers/promises';
import { defineExtension, defineTool } from '@earendil-works/pi-durable';
import { obj, oneOf } from '@earendil-works/pi-schema';
import type { Emit } from './events.ts';
import { FIXTURES } from './fixtures.ts';

// This barrier controls the recording, not recovery. Every invocation starts
// again normally; only Pi Durable decides whether the tool needs replaying.
export class TrainGate {
  private open = false;
  private waiters = new Set<() => void>();
  release() {
    this.open = true;
    for (const resolve of this.waiters) resolve();
    this.waiters.clear();
  }
  isOpen() { return this.open; }
  async wait(signal?: AbortSignal) {
    if (this.open) return;
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const done = () => { signal?.removeEventListener('abort', abort); this.waiters.delete(done); resolve(); };
      const abort = () => { this.waiters.delete(done); reject(signal?.reason ?? new Error('Espera cancelada')); };
      this.waiters.add(done);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}

export function createSearch(gate: TrainGate, emit: Emit) {
  const search = defineTool({
    name: 'search',
    description: 'Lee datos SIMULADOS de Viena. Consulta weather, museums y trains en paralelo en una sola ronda. Trains espera una liberación manual de la demo.',
    parameters: obj({ topic: oneOf(['weather', 'museums', 'trains'] as const) }),
    replay: 'safe',
    execute: async ({ topic }, api, context) => {
      emit('tool_enter', { topic, taskId: api.taskId, conversationId: api.conversationId });
      api.output(`Consultando ${topic} (datos simulados)…\n`);
      if (topic === 'trains') {
        emit('train_waiting', { taskId: api.taskId });
        await gate.wait(context.abortSignal);
      } else {
        await sleep(topic === 'weather' ? 250 : 500, undefined, { signal: context.abortSignal });
      }
      // This event is diagnostic only. The transcript's ToolResultEntry is the
      // evidence that Pi Durable actually committed the result.
      emit('tool_returning', { topic, taskId: api.taskId });
      return { output: [{ type: 'text', text: FIXTURES[topic] }] };
    },
  });
  return defineExtension({ name: 'vacation.search', tools: [search] });
}
