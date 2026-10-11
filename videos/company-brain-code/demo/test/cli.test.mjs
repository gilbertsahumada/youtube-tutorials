import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

async function sandbox(run) {
  const root = await mkdtemp(join(tmpdir(), 'company-brain-code-test-'));
  try {
    for (const name of ['src', 'seed', 'fixtures']) await cp(new URL(`../${name}`, import.meta.url), join(root, name), {recursive: true});
    const cli = (...args) => spawnSync(process.execPath, [join(root, 'src/cli.mjs'), ...args], {
      cwd: root, encoding: 'utf8', env: {...process.env, MODEL_ID: '', MODEL_BASE_URL: '', MODEL_API_KEY: ''}
    });
    const json = async file => JSON.parse(await readFile(join(root, file), 'utf8'));
    await run({root, cli, json});
  } finally { await rm(root, {recursive: true, force: true}); }
}
function ok(result) { assert.equal(result.status, 0, result.stderr || result.stdout); return result.stdout; }

test('el recorrido CLI actualiza archivos y conserva respuestas antes/pendiente/después', async () => sandbox(async ({cli, json}) => {
  ok(cli('reset')); ok(cli('context')); ok(cli('ask', '--fixture'));
  const before = await json('output/before-answer.json');
  assert.equal(before.snapshot.currentFormat, 'CSV'); assert.equal(before.mode, 'fixture');
  ok(cli('ingest')); assert.equal(ok(cli('diff')), '');
  ok(cli('ask', '--fixture')); assert.equal((await json('output/pending-answer.json')).snapshot.currentFormat, 'CSV');
  ok(cli('approve', '--yes', '--reviewer', 'Gilbert'));
  assert.match(ok(cli('diff')), /\+\s+"format": "PDF"/);
  assert.equal((await json('workspace/brain/issue.json')).requiredFormat, 'CSV');
  assert.equal((await json('workspace/brain/slack.json')).messages[0].status, 'suggestion');
  ok(cli('context')); ok(cli('ask', '--fixture'));
  const after = await json('output/after-answer.json');
  assert.equal(after.question, before.question); assert.equal(after.snapshot.currentFormat, 'PDF');
  assert.equal((await json('workspace/brain/agreement.json')).history[0].format, 'CSV');
  ok(cli('approve', '--yes', '--reviewer', 'Gilbert'));
  assert.equal((await json('workspace/brain/agreement.json')).history.length, 1);
  assert.match(ok(cli('ingest')), /No se duplicó/);
}));
test('la CLI rechaza aprobación incompleta o una propuesta manipulada', async () => sandbox(async ({root, cli, json}) => {
  ok(cli('reset')); ok(cli('ingest'));
  assert.equal(cli('approve', '--reviewer', 'Gilbert').status, 1);
  assert.equal(cli('approve', '--yes').status, 1);
  const proposal = await json('workspace/proposal.json'); proposal.toFormat = 'XLSX';
  await writeFile(join(root, 'workspace/proposal.json'), JSON.stringify(proposal));
  assert.match(cli('approve', '--yes', '--reviewer', 'Gilbert').stderr, /alterada/);
  assert.equal((await json('workspace/brain/agreement.json')).current.format, 'CSV');
}));
test('ask sin configurar falla y nunca guarda una respuesta de fixture', async () => sandbox(async ({cli, json}) => {
  ok(cli('reset')); const result = cli('ask');
  assert.equal(result.status, 1); assert.match(result.stderr, /MODEL_ID/);
  await assert.rejects(json('output/before-answer.json'), {code: 'ENOENT'});
}));
