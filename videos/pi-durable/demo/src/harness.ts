import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxProvider, fauxAssistantMessage, fauxToolCall, fauxText } from '@earendil-works/pi-ai/providers/faux';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { Harness, createRegistry } from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { FIXTURES, TOPICS } from './fixtures.ts';
import { createSearch, TrainGate } from './tools.ts';
import { createVacation, messageText } from './research.ts';
import type { Emit } from './events.ts';

export { context };
export type Provider = 'faux' | 'openai';
export type SessionConfig = { provider: Provider; model: string };

export async function openApp(database: string, config: SessionConfig, emit: Emit) {
  const models = createModels();
  if (config.provider === 'faux') {
    const faux = fauxProvider();
    models.setProvider(faux.provider);
    const answer = (text: string) => fauxAssistantMessage([fauxText(text)]);
    faux.setResponses(Array.from({ length: 1000 }, () => request => {
      const last = request.messages.findLast(m => m.role !== 'system');
      const text = messageText(last);
      const child = request.messages.some(m => m.role === 'user' && messageText(m).startsWith('[investigacion]'));
      if (child) {
        if (!request.messages.some(m => m.role === 'toolResult')) {
          return fauxAssistantMessage(TOPICS.map(topic => fauxToolCall('search', { topic }, { id: `search-${topic}` })), { stopReason: 'toolUse' });
        }
        const direct = request.messages.some(m => m.role === 'user' && /directos|trasbordos/i.test(messageText(m)));
        return answer(`REPORTE SIMULADO\n${Object.values(FIXTURES).join('\n')}\n${direct ? 'Prioridad recibida: trenes directos, evitar trasbordos.' : 'Sin prioridad adicional.'}`);
      }
      if (last?.role === 'user' && text.startsWith('[viaje]')) {
        return fauxAssistantMessage([fauxToolCall('research', { task: 'Investiga clima, museos y trenes para Viena.' }, { id: 'research-trip' })], { stopReason: 'toolUse' });
      }
      if (text.startsWith('[research report]')) {
        return answer(`PLAN FINAL (proveedor faux, datos simulados)\nDía 1: paseo al aire libre y Kunsthistorisches Museum.\nDía 2: Belvedere por la mañana y actividad interior por la tarde.\nDía 3: llegada o salida en tren.\n${text}`);
      }
      if (last?.role === 'toolResult') return answer('La investigación está en background. Podemos seguir conversando mientras esperamos los trenes.');
      return answer('El plan es de tres días en Viena. La investigación y su estado se consultan con demo:status. Esta respuesta está programada por el proveedor faux.');
    }));
  } else {
    if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('Para openai configura OPENAI_API_KEY en .env. No se necesita para faux.');
    if (!config.model.trim()) throw new Error('Para openai configura PI_MODEL o pasa --model con un ID soportado.');
    models.setProvider(openaiProvider());
    if (!models.getModel('openai', config.model)) throw new Error(`El modelo ${config.model} no está registrado en Pi AI 1.5.0. Elige un ID soportado por esta versión.`);
  }
  const gate = new TrainGate();
  const Search = createSearch(gate, emit);
  const Vacation = createVacation(Search, emit);
  const registry = createRegistry();
  registry.install(Search); registry.install(Vacation);
  const harness = await Harness.open(await openNodeSqliteStorage(database), {
    models, registry,
    onReport: report => emit('harness_report', { kind: report.kind, message: report.error instanceof Error ? report.error.message : String(report.error) }),
  }, context);
  const root = await harness.root(context, { agent: {
    model: { provider: config.provider, modelId: config.model }, extensions: [Vacation], maxTurns: 8,
  } });
  return { harness, root, gate };
}

export type App = Awaited<ReturnType<typeof openApp>>;
