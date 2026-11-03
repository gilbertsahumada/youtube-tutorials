import {
  AssistantEntry, configure, defineExtension, defineTask, defineTool, section,
  type ConversationId, type Extension,
} from '@earendil-works/pi-durable';
import { obj, str } from '@earendil-works/pi-schema';
import type { Emit } from './events.ts';

export const RESEARCH_TASK = 'vacation.research';
export function messageText(message: { content: unknown } | undefined): string {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(part => part.type === 'text').map(part => part.text as string).join('\n');
}

export function createVacation(Search: Extension, emit: Emit) {
  type State = { phase: 'deliver' } | { phase: 'report'; report: string };
  const Research = defineTask<{ task: string }, State, null>({
    name: RESEARCH_TASK,
    version: 1,
    initial: () => ({ phase: 'deliver' }),
    phases: {
      deliver: async (task, runtime, context) => {
        let childId: ConversationId | undefined;
        await runtime.commit(async tx => {
          childId = (await tx.scanConversations({ ownerTaskId: task.id }, 1)).items[0]?.id;
          return undefined;
        }, context);
        if (childId === undefined) throw new Error('Falta la conversación de investigación');
        const child = await runtime.conversation(childId, context);
        if (!child) throw new Error('No se encontró el subagente');
        const submission = await child.submit({
          type: 'input', content: task.input.task, requestId: `research:${task.id}`,
        }, context);
        const settled = await submission.wait(context);
        await runtime.commit(async tx => {
          const report = settled.status === 'done' && settled.type === 'input'
            ? messageText((await tx.entry(AssistantEntry, settled.answer))?.model?.[0])
            : 'La investigación falló. Revisa el estado y los eventos antes de continuar.';
          return { status: 'running', checkpoint: { phase: 'report', report } };
        }, context);
      },
      report: async (task, runtime, context) => {
        const main = await runtime.conversation(runtime.conversationId, context);
        if (!main) throw new Error('Falta la conversación principal');
        const submission = await main.submit({
          type: 'input', content: `[research report] ${task.state.checkpoint.report}`,
          whenBusy: 'followUp', requestId: `research-report:${task.id}`,
        }, context);
        emit('report_admitted', { taskId: task.id, submissionId: submission.id });
        await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result: null } }), context);
      },
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context);
    },
  });
  const research = defineTool({
    name: 'research',
    description: 'Inicia la investigación de este único viaje en background. El principal sigue conversando. El reporte llega como mensaje después.',
    parameters: obj({ task: str() }),
    replay: 'safe',
    execute: async ({ task }, api, context) => {
      // One trip per session. Admission and child creation are atomic; replay
      // finds the same research instead of starting another subagent.
      const ids = await api.commit(async tx => {
        const existing = (await tx.scanTasks({ conversationId: api.conversationId }, 1000)).items
          .find(t => t.kind === RESEARCH_TASK);
        if (existing) {
          const child = (await tx.scanConversations({ ownerTaskId: existing.id }, 1)).items[0];
          return { taskId: existing.id, childId: child?.id };
        }
        const taskId = await tx.createTask(Research, { task: `[investigacion] ${task}` }, {
          ownership: { kind: 'conversation' }, background: true,
        });
        const child = await tx.createConversation({ ownership: { kind: 'task', taskId } });
        await configure(tx, child.id, {
          extensions: [Search], maxTurns: 8,
          instructions: 'Investiga un viaje de tres días a Viena con datos simulados. Llama a search para weather, museums y trains en paralelo en una sola ronda. Espera sus resultados. Responde en español con un reporte breve, respeta las nuevas prioridades y aclara que los datos son simulados.',
        });
        return { taskId, childId: child.id };
      }, context);
      emit('research_admitted', ids);
      return { output: [{ type: 'text', text: `Investigación en background. Conversación ${ids.childId}, tarea ${ids.taskId}. Puedes seguir conversando.` }] };
    },
  });
  return defineExtension({
    name: 'vacation.main', tools: [research], tasks: [Research],
    sections: [section('vacation', () => 'Eres un planificador de viajes. Responde brevemente en español. Delega la investigación en research, una sola vez por viaje. Mientras trabaja, conversa con el usuario sin volver a iniciar otra investigación. Cuando llegue [research report], prepara el plan de tres días, mencionando que usa datos simulados. No declares resultados que aún no llegaron.')],
  });
}
