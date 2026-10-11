import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {QUESTION, makeProposal, approveProposal, buildContext, buildMessages, fixtureAnswer, validateAnswer} from '../src/memory.mjs';
import {askModel, requestBody} from '../src/model.mjs';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const memory = {
  project: await read('../seed/brain/project.json'), agreement: await read('../seed/brain/agreement.json'),
  issue: await read('../seed/brain/issue.json'), slack: await read('../seed/brain/slack.json'),
  rules: await readFile(new URL('../seed/brain/rules.md', import.meta.url), 'utf8')
};
const event = await read('../fixtures/event.json');
const options = {confirmed: true, reviewer: 'Gilbert', now: '2026-01-17T10:00:00Z'};

test('estado inicial: CSV vigente, issue alineado y Excel no aprobado', () => {
  const answer = fixtureAnswer(QUESTION, buildContext(memory));
  assert.match(answer.answer, /vigente es CSV/); assert.match(answer.answer, /issue coincide/);
  assert.match(answer.answer, /Excel continúa siendo una sugerencia/);
});
test('ingestar propone PDF sin mutar memoria ni subir versión', () => {
  const before = structuredClone(memory), proposal = makeProposal(memory, event);
  assert.equal(proposal.status, 'pending'); assert.equal(proposal.toFormat, 'PDF');
  assert.deepEqual(memory, before); assert.equal(memory.agreement.version, 1);
  const context = buildContext(memory, event, proposal);
  assert.equal(context.snapshot.currentFormat, 'CSV');
  assert.match(fixtureAnswer(QUESTION, context).answer, /no reemplaza todavía CSV/);
});
test('aprobar cambia solo el acuerdo, conserva historial y señala el issue desactualizado', () => {
  const proposal = makeProposal(memory, event), before = structuredClone(memory);
  const result = approveProposal(memory, proposal, options);
  assert.equal(result.agreement.version, 2); assert.equal(result.agreement.current.format, 'PDF');
  assert.equal(result.agreement.current.approvedBy, 'Gilbert');
  assert.equal(result.agreement.history[0].format, 'CSV'); assert.equal(result.agreement.history[0].status, 'superseded');
  assert.deepEqual(memory, before);
  const context = buildContext({...memory, agreement: result.agreement}, event, result.proposal);
  assert.match(fixtureAnswer(QUESTION, context).answer, /issue todavía solicita CSV/);
});
test('sin confirmación y nombre de reviewer no se aprueba', () => {
  const proposal = makeProposal(memory, event);
  assert.throws(() => approveProposal(memory, proposal, {reviewer: 'Gilbert'}), /--yes/);
  assert.throws(() => approveProposal(memory, proposal, {confirmed: true}), /--reviewer/);
});
test('una propuesta obsoleta no reemplaza una versión nueva', () => {
  const proposal = makeProposal(memory, event), changed = structuredClone(memory); changed.agreement.version++;
  assert.throws(() => approveProposal(changed, proposal, options), /memoria cambió/);
});
test('reintentar una aprobación no duplica historial y recupera el estado de la propuesta', () => {
  const proposal = makeProposal(memory, event), first = approveProposal(memory, proposal, options);
  const recovered = approveProposal({...memory, agreement: first.agreement}, proposal, options);
  assert.equal(recovered.agreement.history.length, 1); assert.equal(recovered.proposal.status, 'approved');
  assert.equal(recovered.proposal.approvedAt, options.now);
});
for (const [name, changes] of [
  ['otro proyecto', {projectId: 'otro'}], ['otro remitente', {from: 'otro@example.com'}],
  ['formato desconocido', {format: 'ZIP'}], ['evidencia inventada', {evidence: 'Una confirmación que no está en el correo PDF'}],
  ['fecha anterior', {receivedAt: '2025-01-01T00:00:00Z'}], ['ruta en el ID', {id: '../escape'}]
]) test(`rechaza ${name}`, () => assert.throws(() => makeProposal(memory, {...event, ...changes})));
test('el prompt contiene la pregunta y el snapshot, pero no autoriza acciones', () => {
  const context = buildContext(memory), messages = buildMessages(QUESTION, context);
  assert.deepEqual(JSON.parse(messages[1].content), {question: QUESTION, context});
  assert.match(messages[0].content, /No tienes herramientas/);
});
test('no acepta citas inventadas ni respuestas vacías', () => {
  const context = buildContext(memory);
  assert.throws(() => validateAnswer({answer: 'PDF', citations: ['no-existe']}, context), /no recibió/);
  assert.throws(() => validateAnswer({answer: '', citations: []}, context), /inválida/);
  assert.throws(() => validateAnswer({answer: 'CSV', citations: []}, context), /sin fuentes/);
});
test('el modelo no puede sobrescribir el modo, la pregunta o el snapshot del programa', () => {
  const result = validateAnswer({answer: 'CSV', citations: ['decision:exportacion'], mode: 'fixture', snapshot: {version: 999}}, buildContext(memory));
  assert.deepEqual(Object.keys(result), ['answer', 'citations']);
});
test('la fixture no simula responder cualquier pregunta', () => {
  assert.throws(() => fixtureAnswer('¿Quién es el CEO?', buildContext(memory)), /predeterminada/);
});
test('el request no contiene secretos ni herramientas; el adaptador valida la respuesta', async () => {
  const context = buildContext(memory), messages = buildMessages(QUESTION, context);
  const env = {MODEL_ID: 'test-model', MODEL_BASE_URL: 'https://example.com/v1', MODEL_API_KEY: 'secret-test'};
  const body = requestBody(messages, env);
  assert.ok(!JSON.stringify(body).includes(env.MODEL_API_KEY)); assert.ok(!('tools' in body));
  const result = await askModel(body, context, env, async (url, options) => {
    assert.equal(url, 'https://example.com/v1/chat/completions');
    assert.equal(options.headers.authorization, 'Bearer secret-test');
    assert.deepEqual(JSON.parse(options.body), body);
    return {ok: true, json: async () => ({choices: [{message: {content: JSON.stringify({answer: 'CSV', citations: ['decision:exportacion']})}}]})};
  });
  assert.equal(result.answer, 'CSV');
});
test('no usa HTTP ni responde silenciosamente con una fixture cuando falla el proveedor', async () => {
  const context = buildContext(memory), body = requestBody(buildMessages(QUESTION, context), {MODEL_ID: 'test'});
  await assert.rejects(askModel(body, context, {MODEL_BASE_URL: 'http://example.com/v1', MODEL_API_KEY: 'x'}), /HTTPS/);
  await assert.rejects(askModel(body, context, {MODEL_BASE_URL: 'https://example.com/v1', MODEL_API_KEY: 'x'}, async () => ({ok: false, status: 401})), /HTTP 401/);
});
