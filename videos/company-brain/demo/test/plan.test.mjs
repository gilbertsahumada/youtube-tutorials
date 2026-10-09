import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPlan, messageKey } from '../src/plan.mjs';
import { mailbox, plainText } from '../src/gmail.mjs';
const read = async path => JSON.parse(await readFile(new URL('../'+path, import.meta.url), 'utf8'));
const initial = {
  email:await read('fixtures/email.json'), analysis:await read('fixtures/analysis.json'),
  project:await read('seed/brain/projects/portal-cliente.json'), decision:await read('seed/brain/decisions/exportacion.json'),
  issue:await read('fixtures/issue.json'), approvedSender:'client@example.com'
};
const input = () => structuredClone(initial);

test('propone PDF, conserva CSV y no cambia el issue', () => {
  const data = input(); const before = structuredClone(data);
  const plan = buildPlan(data);
  assert.equal(plan.action, 'propose'); assert.equal(plan.toFormat, 'PDF');
  assert.equal(plan.files.length, 2);
  const decision = JSON.parse(plan.files[0].content);
  assert.equal(decision.current.format, 'PDF');
  assert.equal(decision.history[0].format, 'CSV');
  assert.equal(decision.history[0].status, 'superseded');
  assert.match(plan.files[1].content, /Excel sigue como propuesta/);
  assert.deepEqual(data, before);
});
test('no eleva una propuesta a decisión', () => {
  const data = input(); data.analysis.approved = false;
  assert.equal(buildPlan(data).action, 'skip');
});
test('remitente distinto no puede proponer cambios', () => {
  const data = input(); data.email.from = 'attacker@example.com';
  assert.throws(() => buildPlan(data), /Remitente/);
});
test('no acepta evidencia inventada', () => {
  const data = input(); data.analysis.evidence = 'El cliente aprobó XLSX en otro documento.';
  assert.throws(() => buildPlan(data), /extracto literal/);
});
test('no acepta pendientes inventados', () => {
  const data = input(); data.analysis.pending = ['PDF y Excel aprobados'];
  assert.throws(() => buildPlan(data), /Pendientes|pendientes/);
});
test('no acepta rutas ni formatos arbitrarios del modelo', () => {
  const data = input(); data.analysis.format = '../../.github/workflows/attack';
  assert.throws(() => buildPlan(data), /Formato/);
});
test('rechaza otro proyecto, entrega o requisito', () => {
  for (const key of ['project','delivery','requirement']) {
    const data = input(); data.analysis[key] = 'otro';
    assert.throws(() => buildPlan(data), /Contexto/);
  }
});
test('rechaza un issue sin la relación explícita', () => {
  const data = input(); data.issue.title = 'Otro'; data.issue.body = 'Exportar CSV';
  assert.throws(() => buildPlan(data), /Issue no relacionado/);
});
test('rechaza issues cerrados', () => {
  const data = input(); data.issue.state = 'closed';
  assert.throws(() => buildPlan(data), /abierto/);
});
test('no reemplaza decisiones recientes con correos antiguos', () => {
  const data = input(); data.decision.current.receivedAt = '2026-01-17T00:00:00Z';
  assert.equal(buildPlan(data).action, 'skip');
});
test('una decisión ya vigente no genera otro cambio', () => {
  const data = input(); data.decision.current.format = 'PDF';
  assert.equal(buildPlan(data).action, 'skip');
});
test('IDs son estables y no pueden escapar de rutas', () => {
  assert.equal(messageKey('../evil'), messageKey('../evil'));
  assert.match(messageKey('../evil'), /^[a-f0-9]{20}$/);
});
test('correo sin confirmación literal requiere revisión', () => {
  const data = input(); data.email.text = 'Quizás podríamos entregar PDF para este proyecto.';
  data.analysis.evidence = data.email.text; data.analysis.pending = [];
  assert.throws(() => buildPlan(data), /confirmación/);
});
test('parsea dirección de correo sin aceptar varios remitentes', () => {
  assert.equal(mailbox('Cliente <CLIENT@example.com>'), 'client@example.com');
  assert.throws(() => mailbox('a@example.com,b@example.com'), /ambiguo/);
});
test('lee texto plano multipart; ignora HTML y adjuntos', () => {
  const encode = text => Buffer.from(text).toString('base64url');
  assert.equal(plainText({mimeType:'multipart/mixed',parts:[
    {mimeType:'text/html',body:{data:encode('<b>No</b>')}},
    {mimeType:'text/plain',body:{data:encode('Confirmado PDF')}},
    {mimeType:'text/plain',filename:'attachment.txt',body:{data:encode('Ignorar')}}
  ]}), 'Confirmado PDF');
});
