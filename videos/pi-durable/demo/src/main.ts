import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import { openApp, context, type App, type SessionConfig } from './harness.ts';
import { createEvents } from './events.ts';
import { TRIP, STEER } from './fixtures.ts';
import { listen, request, type Request } from './control.ts';
import { allEntries, researchState, status, readEvents } from './state.ts';
import { AssistantEntry } from '@earendil-works/pi-durable';
import { messageText } from './research.ts';

const parsed = parseArgs({ allowPositionals: true, options: {
  'data-dir': { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' }, json: { type: 'boolean' },
} });
const [command = 'help', ...words] = parsed.positionals;
const directory = path.resolve(parsed.values['data-dir'] ?? fileURLToPath(new URL('../.data', import.meta.url)));
const configPath = path.join(directory, 'session.json');
const database = path.join(directory, 'session.sqlite');
const help = `Pi Durable: planificador de Viena (consultas simuladas)

start [--provider faux|openai] [--model ID]    Crear una sesión, no envía un pedido
resume                                     Abrir la sesión existente y reanudar
trip                                       Enviar el pedido estable de esta demo
ask "mensaje"                              Hablar con la conversación principal
steer ["instrucción"]                       Dirigir al subagente ocupado
status [--json]                             Estado confirmado y conteos observados
release                                    Liberar trenes en el proceso activo
crash                                      El proceso servidor se termina con SIGKILL
stop                                       Cerrar normalmente, conserva SQLite
events                                     Seguir eventos (Ctrl+C cierra solo este visor)

Todos aceptan --data-dir RUTA. Una carpeta por sesión y un proceso por SQLite.
En la consola interactiva: /trip /status /release /steer texto /quit /help.
Faux usa respuestas programadas, no un LLM remoto. Openai requiere .env.`;

async function serve(resume: boolean) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  let app: App | undefined;
  let stopping = false;
  let ready = false;
  let config: SessionConfig;
  const emit = createEvents(directory);
  const seen = new Set<number>();
  const restored = new Set<number>();
  let observing = false;
  let interactiveQueue = Promise.resolve();
  const handle = async (input: Request): Promise<unknown> => {
    if (!ready || !app || stopping) throw new Error('La sesión está iniciando o cerrando. Espera session_ready.');
    if (input.command === 'status') {
      const { entries: _entries, ...view } = await status(app, directory, config); return view;
    }
    if (input.command === 'release') { app.gate.release(); emit('gate_released'); return { released: true }; }
    if (input.command === 'crash') {
      emit('crash_requested', { rootId: app.root.id });
      setTimeout(() => process.kill(process.pid, 'SIGKILL'), 50);
      return { pid: process.pid, signal: 'SIGKILL', message: 'Este servidor se terminará. Conserva el mismo data-dir para resume.' };
    }
    if (input.command === 'stop') { setTimeout(() => void stop(), 50); return { closing: true }; }
    if (input.command === 'steer') {
      const { child } = await researchState(app);
      if (!child) throw new Error('Primero inicia una investigación con trip.');
      const text = input.text?.trim() || STEER;
      const submission = await child.submit({ type: 'input', content: text, whenBusy: 'steer', whenIdle: 'reject', requestId: `steer:${randomUUID()}` }, context);
      emit('steer_admitted', { childId: child.id, submissionId: submission.id, text });
      return { childId: child.id, submissionId: submission.id, message: 'Se aplicará después de la ronda de herramientas. Ahora puedes liberar trenes.' };
    }
    if (input.command === 'trip' || input.command === 'ask') {
      const content = input.command === 'trip' ? TRIP : input.text?.trim();
      if (!content) throw new Error('Indica el mensaje: npm run demo:ask -- "tu pregunta"');
      const submission = await app.root.submit({ type: 'input', content,
        requestId: input.command === 'trip' ? 'vacation-trip:1' : `user:${randomUUID()}` }, context);
      emit('input_admitted', { submissionId: submission.id, command: input.command });
      const settled = await submission.wait(context);
      if (settled.status !== 'done' || settled.type !== 'input') throw new Error(`El pedido terminó sin respuesta: ${JSON.stringify(settled)}`);
      const answer = await app.root.commit(tx => tx.entry(AssistantEntry, settled.answer), context);
      return { submissionId: submission.id, answer: messageText(answer?.model?.[0]) };
    }
    throw new Error(`Comando desconocido: ${input.command}`);
  };
  // Bind before opening SQLite: two owners must not open the same session.
  const server = await listen(directory, handle);
  let interval: NodeJS.Timeout | undefined;
  let terminal: ReturnType<typeof createInterface> | undefined;
  async function stop() {
    if (stopping) return; stopping = true; ready = false;
    if (interval) clearInterval(interval);
    terminal?.close();
    try {
      while (observing) await new Promise(resolve => setTimeout(resolve, 10));
      await app?.harness.close(context);
      emit('session_closed');
    } finally { server.close(); }
  }
  try {
    if (resume) {
      config = JSON.parse(await fs.readFile(configPath, 'utf8')) as SessionConfig;
      if (!['faux', 'openai'].includes(config.provider) || typeof config.model !== 'string') throw new Error('Configuración de sesión inválida');
      await fs.access(database);
      if (parsed.values.provider && parsed.values.provider !== config.provider) throw new Error('Resume usa el proveedor guardado. Usa otro data-dir para otro proveedor.');
    } else {
      const existing = await fs.readdir(directory);
      if (existing.includes('session.sqlite') || existing.includes('session.json')) throw new Error('La carpeta ya contiene una sesión. Usa demo:resume o un --data-dir nuevo.');
      const provider = parsed.values.provider ?? 'faux';
      if (provider !== 'faux' && provider !== 'openai') throw new Error('Proveedor válido: faux u openai');
      config = { provider, model: provider === 'faux' ? 'faux-1' : parsed.values.model ?? process.env.PI_MODEL ?? '' };
    }
    app = await openApp(database, config, emit);
    if (!resume) await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    if (resume) {
      const { child } = await researchState(app);
      for (const chat of [app.root, child]) {
        if (chat) for (const entry of await allEntries(chat)) restored.add(entry.id);
      }
    }
    app.harness.resume(); ready = true;
    emit('session_ready', { rootId: app.root.id, provider: config.provider, model: config.model, resumed: resume, directory });
    console.log(`\n${config.provider === 'faux' ? 'MODO FAUX: respuestas programadas, sin llamadas de pago.' : 'MODELO REAL: llamadas al proveedor OpenAI.'}\nDatos de viaje simulados. Trenes espera demo:release, también después del reinicio.\nUsa demo:trip en otra terminal o /trip aquí.\n`);
    async function observe() {
      if (observing || stopping || !app) return; observing = true;
      try {
        const { child } = await researchState(app);
        const timeline = [
          ...(await allEntries(app.root)).map(entry => ({ name: 'principal', chat: app!.root, entry })),
          ...(child ? (await allEntries(child)).map(entry => ({ name: 'investigador', chat: child, entry })) : []),
        ].sort((a, b) => a.entry.id - b.entry.id);
        for (const { name, chat, entry } of timeline) {
            if (seen.has(entry.id)) continue; seen.add(entry.id);
            if (entry.kind === 'pi.assistant' || entry.kind === 'pi.tool-result') {
              const calls = (entry.model ?? []).flatMap(message => message.role === 'assistant'
                ? message.content.filter(part => part.type === 'toolCall').map(part => ({ id: part.id, name: part.name })) : []);
              emit(entry.kind === 'pi.tool-result' ? 'tool_result_committed' : 'assistant_committed', {
                conversation: name, conversationId: chat.id, entryId: entry.id,
                text: (entry.model ?? []).map(messageText).filter(Boolean).join('\n'),
                ...(calls.length ? { calls } : {}),
                restored: restored.has(entry.id),
              });
            }
        }
      } catch (error) { emit('observer_error', { message: error instanceof Error ? error.message : String(error) }); }
      finally { observing = false; }
    }
    interval = setInterval(() => void observe(), 150);
    await observe();
    if (process.stdin.isTTY) {
      terminal = createInterface({ input: process.stdin, output: process.stdout, prompt: 'viaje> ' });
      terminal.prompt();
      terminal.on('line', line => {
        const value = line.trim(); if (!value) { terminal?.prompt(); return; }
        if (value === '/help') { console.log(help); terminal?.prompt(); return; }
        const [name, ...rest] = value.split(' ');
        const input = value.startsWith('/') ? { command: name === '/quit' ? 'stop' : name.slice(1), text: rest.join(' ') } : { command: 'ask', text: value };
        interactiveQueue = interactiveQueue.then(() => handle(input))
          .then(result => console.log(JSON.stringify(result, null, 2)), error => console.error(String(error)))
          .finally(() => terminal?.prompt());
      });
      terminal.on('close', () => { if (!stopping) void stop(); });
    }
    process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
  } catch (error) {
    await stop(); throw error;
  }
}

async function run() {
  if (process.platform === 'win32') throw new Error('Esta demo usa sockets Unix: ejecuta en macOS, Linux o WSL.');
  if (command === 'start' || command === 'resume') return serve(command === 'resume');
  if (command === 'help') { console.log(help); return; }
  if (command === 'events') {
    let count = 0; let reading = false;
    const show = async () => {
      if (reading) return; reading = true;
      try { const events = await readEvents(directory); for (const event of events.slice(count)) console.log(JSON.stringify(event)); count = events.length; }
      catch (error) { console.error(String(error)); process.exitCode = 1; clearInterval(timer); }
      finally { reading = false; }
    };
    const timer = setInterval(() => void show(), 200); await show(); return;
  }
  const result = await request(directory, { command, text: words.join(' ') }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') throw new Error('No hay un servidor activo para este data-dir. Inicia demo o demo:resume primero.'); throw error;
  });
  console.log(JSON.stringify(result, null, 2));
}
run().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
