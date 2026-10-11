import test from 'node:test';
import assert from 'node:assert/strict';
import { publish, notifyIssue } from '../src/github.mjs';
import { buildPlan } from '../src/plan.mjs';
import { readFile } from 'node:fs/promises';
const read = async path => JSON.parse(await readFile(new URL('../'+path, import.meta.url), 'utf8'));
const plan = buildPlan({ email:await read('fixtures/email.json'), analysis:await read('fixtures/analysis.json'),
  project:await read('seed/brain/projects/portal-cliente.json'), decision:await read('seed/brain/decisions/exportacion.json'),
  issue:await read('fixtures/issue.json'), approvedSender:'client@example.com' });
const context = {repo:'demo/sandbox', base:'main',sha:'base-sha',tree:'base-tree'};

test('publica dos archivos en un único commit, PR y nunca merge ni edición del issue', () => {
  const calls = [];
  const api = (path, options = {}) => {
    calls.push({path,...options});
    if (path.includes('/pulls?')) return [];
    if (path.includes('/commits/main')) return {sha:'base-sha'};
    if (path.includes('/matching-refs/')) return [];
    if (path.endsWith('/git/trees')) return {sha:'new-tree'};
    if (path.endsWith('/git/commits')) return {sha:'new-commit'};
    if (path.endsWith('/git/refs')) return {};
    if (path.endsWith('/pulls')) return {number:2,html_url:'https://github.com/demo/sandbox/pull/2'};
    throw Error('Llamada no esperada: '+path);
  };
  assert.equal(publish(plan, context, api).number, 2);
  const tree = calls.find(x => x.path.endsWith('/git/trees')).body;
  assert.deepEqual(tree.tree.map(x => x.path), plan.files.map(x => x.path));
  assert.ok(!calls.some(x => x.path.includes('/merge') || x.path.includes('/issues/')));
});
test('recupera un PR existente sin duplicar escrituras', () => {
  const calls = [];
  const result = publish(plan, context, (path, options) => {
    calls.push({path,options});
    if (path.includes('/pulls?')) return [{number:2,body:`<!-- company-brain:${plan.key} -->`}];
    const file = plan.files.find(file => path.includes('/contents/'+file.path+'?'));
    return {content:Buffer.from(file.content).toString('base64')};
  });
  assert.equal(result.number, 2); assert.equal(calls.length, 3);
  assert.ok(calls.every(call => !call.options));
});
test('no publica sobre una base modificada durante el análisis', () => {
  assert.throws(() => publish(plan, context, path => path.includes('/pulls?') ? [] : {sha:'other'}), /base cambió/);
});
test('comentario idempotente con paginación', () => {
  let writes = 0;
  notifyIssue(plan, {html_url:'https://example.com'}, 'demo/sandbox', (path, options) => {
    if (options) { writes++; return {}; }
    if (path.endsWith('page=1')) return Array.from({length:100}, () => ({body:'otro'}));
    return [{body:`<!-- company-brain:${plan.key} -->`}];
  });
  assert.equal(writes, 0);
});
test('comenta una vez y no actualiza el cuerpo del issue', () => {
  const calls = [];
  notifyIssue(plan, {html_url:'https://example.com'}, 'demo/sandbox', (path, options) => {
    calls.push({path,...options}); return options ? {} : [];
  });
  assert.equal(calls[1].method, 'POST');
  assert.ok(calls[1].path.endsWith('/issues/1/comments'));
  assert.match(calls[1].body.body, /No se cambió el requisito/);
});
