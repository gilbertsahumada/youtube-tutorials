import {readFile, writeFile, mkdir, rename, cp, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {QUESTION, makeProposal, approveProposal, buildContext, buildMessages, fixtureAnswer} from './memory.mjs';
import {requestBody, askModel} from './model.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WORK = join(ROOT, 'workspace'), OUTPUT = join(ROOT, 'output');
const args = process.argv.slice(2), command = args.shift();
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw Error(`Falta el valor de ${name}`);
  return value;
}
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function optional(path) { try { return await json(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function save(path, value) {
  await mkdir(dirname(path), {recursive: true});
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await rename(temp, path);
}
async function memory() {
  try {
    return {
      project: await json(join(WORK, 'brain/project.json')),
      agreement: await json(join(WORK, 'brain/agreement.json')),
      issue: await json(join(WORK, 'brain/issue.json')),
      slack: await json(join(WORK, 'brain/slack.json')),
      rules: await readFile(join(WORK, 'brain/rules.md'), 'utf8')
    };
  } catch (error) { if (error.code === 'ENOENT') throw Error('Primero ejecuta npm run reset'); throw error; }
}
async function state() {
  const data = await memory(), proposal = await optional(join(WORK, 'proposal.json'));
  const event = await optional(join(WORK, 'events/email-pdf.json'));
  return {data, proposal, event, context: buildContext(data, event, proposal)};
}
const print = value => console.log(JSON.stringify(value, null, 2));

async function main() {
  if (command === 'reset') {
    await rm(WORK, {recursive: true, force: true});
    await rm(OUTPUT, {recursive: true, force: true});
    await cp(join(ROOT, 'seed'), WORK, {recursive: true});
    console.log('Memoria reiniciada en workspace/: CSV vigente, issue CSV y Excel como sugerencia.');
    return;
  }
  if (command === 'show') { const {data, event, proposal} = await state(); print({memory: data, event, proposal}); return; }
  if (command === 'ingest') {
    const data = await memory(), event = await json(join(ROOT, 'fixtures/event.json'));
    const existing = await optional(join(WORK, 'proposal.json'));
    if (existing) {
      if (existing.eventId !== event.id) throw Error('Ya hay otra propuesta; revisa el estado antes de continuar');
      console.log(`El evento ya tiene la propuesta ${existing.id}: ${existing.status}. No se duplicó.`);
      return;
    }
    const proposal = makeProposal(data, event);
    await save(join(WORK, `events/${event.id}.json`), event);
    await save(join(WORK, 'proposal.json'), proposal);
    print(proposal);
    console.log('Evento SIMULADO. Se guardó una propuesta, no se cambió el acuerdo vigente.');
    return;
  }
  if (command === 'approve') {
    const {data, proposal, event} = await state();
    if (!proposal || !event) throw Error('Primero ejecuta npm run ingest');
    if (data.agreement.current.proposalId !== proposal.id) {
      const expected = makeProposal(data, event);
      for (const key of Object.keys(expected)) if (proposal[key] !== expected[key]) throw Error(`La propuesta fue alterada: ${key}`);
    }
    const next = approveProposal(data, proposal, {confirmed: args.includes('--yes'), reviewer: option('--reviewer')});
    // Save agreement first; retrying approval repairs a remaining pending proposal.
    await save(join(WORK, 'brain/agreement.json'), next.agreement);
    await save(join(WORK, 'proposal.json'), next.proposal);
    console.log('PDF vigente. CSV conservado en history. El issue y Slack NO cambiaron.');
    return;
  }
  if (command === 'diff') {
    await memory();
    const result = spawnSync('git', ['diff', '--no-index', '--', join(ROOT, 'seed/brain'), join(WORK, 'brain')], {stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0 && result.status !== 1) throw Error('No se pudo comparar la memoria');
    return;
  }
  if (command === 'context' || command === 'ask') {
    const {context} = await state(), question = option('--question', QUESTION);
    const phase = context.snapshot.proposalStatus === 'pending' ? 'pending' : context.snapshot.version === 1 ? 'before' : 'after';
    const messages = buildMessages(question, context);
    await save(join(OUTPUT, `${phase}-context.json`), context);
    await save(join(OUTPUT, `${phase}-messages.json`), messages);
    if (command === 'context') {
      print(context);
      console.log(`Prompt completo: output/${phase}-messages.json`);
      return;
    }
    const fixture = args.includes('--fixture');
    let answer;
    if (fixture) {
      answer = fixtureAnswer(question, context);
    } else {
      try { process.loadEnvFile(join(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const body = requestBody(messages);
      await save(join(OUTPUT, `${phase}-request.json`), body);
      answer = await askModel(body, context);
    }
    const result = {mode: fixture ? 'fixture' : 'llm', question, snapshot: context.snapshot, ...answer};
    await save(join(OUTPUT, `${phase}-answer.json`), result);
    console.log(fixture ? 'RESPUESTA SIMULADA: plantilla determinista, sin llamada al LLM.' : 'RESPUESTA DEL LLM: una llamada real al proveedor configurado.');
    print(result);
    return;
  }
  throw Error('Comandos: reset, show, context, ask [--fixture], ingest, approve --yes --reviewer NOMBRE, diff');
}
main().catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
