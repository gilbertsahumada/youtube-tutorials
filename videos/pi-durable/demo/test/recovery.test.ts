import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { request } from '../src/control.ts';
import { readEvents } from '../src/state.ts';

const demo = fileURLToPath(new URL('../', import.meta.url));
const main = path.join(demo, 'src/main.ts');
const execute = promisify(execFile);
type View = {
  pid: number; rootId: number; childId: number | null; childCount: number;
  researchTaskId: number | null; confirmedTopics: string[]; gateOpen: boolean;
  attempts: { weather: number; museums: number; trains: number };
  reportCount: number; answersAfterReport: string[];
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until<T>(read: () => Promise<T | false>, message: string): Promise<T> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const value = await read(); if (value) return value; await sleep(40);
  }
  throw new Error(`Timeout: ${message}`);
}

test('CLI real: background, SIGKILL, SQLite, replay seguro, steering y entrega única', { timeout: 45_000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pi-durable-cli-'));
  const children = new Set<ChildProcess>();
  const outputs: string[] = [];
  let passed = false;
  function start(command: string, extra: string[] = []) {
    const processHandle = spawn(process.execPath, ['--import', 'tsx', main, command, '--data-dir', directory, ...extra], {
      cwd: demo, env: { ...process.env, OPENAI_API_KEY: '', PI_MODEL: '' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(processHandle);
    processHandle.stdout.on('data', chunk => outputs.push(chunk.toString()));
    processHandle.stderr.on('data', chunk => outputs.push(chunk.toString()));
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      processHandle.once('error', reject);
      processHandle.once('exit', (code, signal) => { children.delete(processHandle); resolve({ code, signal }); });
    });
    return { processHandle, exited };
  }
  const view = () => request(directory, { command: 'status' }) as Promise<View>;
  // Exercise the public npm commands from the README, not just our IPC helper.
  async function invoke(command: string, text?: string): Promise<unknown> {
    const args = ['run', '--silent', `demo:${command}`, '--', '--data-dir', directory];
    if (text) args.push(text);
    const result = await execute('npm', args, { cwd: demo, timeout: 15_000 });
    return JSON.parse(result.stdout);
  }
  async function ready() {
    return until(async () => { try { return await view(); } catch { return false; } }, 'session_ready');
  }
  t.after(async () => {
    for (const child of children) child.kill('SIGKILL');
    if (passed) await fs.rm(directory, { recursive: true });
    else t.diagnostic(`Estado preservado en ${directory}\n${outputs.join('')}`);
  });

  const first = start('start');
  const empty = await ready(); assert.equal(empty.childId, null);
  // A second owner cannot open SQLite or disturb the running control socket.
  const duplicate = start('resume');
  assert.equal((await duplicate.exited).code, 1);
  assert.equal((await view()).pid, empty.pid);

  const original = await invoke('trip') as { submissionId: number };
  const before = await until(async () => {
    const s = await view();
    return s.confirmedTopics.length === 2 && s.attempts.trains === 1 ? s : false;
  }, 'clima y museos confirmados, trenes en vuelo');
  assert.deepEqual(before.confirmedTopics, ['weather', 'museums']);
  assert.equal(before.gateOpen, false);
  const chat = await invoke('ask', '¿Qué información te falta?') as { answer: string };
  assert.match(chat.answer, /proveedor faux/);
  assert.equal((await view()).reportCount, 0);

  assert.equal((await invoke('status') as View).rootId, before.rootId);
  await invoke('crash');
  const death = await first.exited;
  assert.equal(death.signal, 'SIGKILL');
  await fs.access(path.join(directory, 'session.sqlite'));

  const second = start('resume');
  await ready();
  const resumed = await until(async () => { const s = await view(); return s.attempts.trains === 2 ? s : false; }, 'replay de trenes');
  assert.equal(resumed.rootId, before.rootId);
  assert.equal(resumed.childId, before.childId);
  assert.equal(resumed.researchTaskId, before.researchTaskId);
  assert.equal(resumed.childCount, 1);
  assert.deepEqual(resumed.attempts, { weather: 1, museums: 1, trains: 2 });
  assert.deepEqual(resumed.confirmedTopics, ['weather', 'museums']);
  // trip is the same stable submission, not a new investigation.
  const repeated = await invoke('trip') as { submissionId: number };
  assert.equal(repeated.submissionId, original.submissionId);
  await invoke('steer', 'Prioriza trenes directos y evita trasbordos.');
  await invoke('release');
  const complete = await until(async () => {
    const s = await view(); return s.reportCount === 1 && s.answersAfterReport.length > 0 ? s : false;
  }, 'reporte único y plan final');
  assert.deepEqual(complete.confirmedTopics, ['weather', 'museums', 'trains']);
  assert.match(complete.answersAfterReport.join('\n'), /trenes directos, evitar trasbordos/);
  assert.deepEqual(complete.attempts, { weather: 1, museums: 1, trains: 2 });
  await assert.rejects(request(directory, { command: 'steer', text: 'Ya terminó' }), /idle|inactiva|no run|ConversationIdle/i);
  const events = await readEvents(directory);
  const trains = events.filter(e => e.event === 'tool_enter' && e.topic === 'trains');
  assert.equal(trains.length, 2); assert.equal(trains[0].taskId, trains[1].taskId);
  assert.notEqual(trains[0].pid, trains[1].pid);
  assert(!events.some(e => e.event === 'harness_report' || e.event === 'observer_error'));

  await invoke('stop');
  assert.equal((await second.exited).code, 0);
  // Restart a completed session: no new request is submitted by resume.
  const third = start('resume'); await ready(); await sleep(400);
  const saved = await view();
  assert.equal(saved.rootId, before.rootId); assert.equal(saved.childId, before.childId);
  assert.equal(saved.reportCount, 1); assert.deepEqual(saved.attempts, complete.attempts);
  await invoke('stop'); assert.equal((await third.exited).code, 0);
  await assert.rejects(request(directory, { command: 'status' }));
  t.diagnostic(JSON.stringify({ provider: 'faux', node: process.version, death, rootId: saved.rootId,
    childId: saved.childId, attempts: saved.attempts, trainTaskId: trains[0].taskId,
    reportCount: saved.reportCount, mainRespondedDuringResearch: true, steeringReachedFinalReport: true }));
  passed = true;
});

test('openai sin credencial falla antes de hacer una llamada remota', { timeout: 10_000 }, async () => {
  const { openApp } = await import('../src/harness.ts');
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = '';
  try {
    await assert.rejects(openApp('/unused/session.sqlite', { provider: 'openai', model: 'unused' }, () => {}), /OPENAI_API_KEY/);
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old;
  }
});
