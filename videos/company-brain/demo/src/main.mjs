import { mkdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { ROOT, loadEnv, privatePath, readJson, saveJson } from './common.mjs';
import { classify, buildPlan, messageKey } from './plan.mjs';
import { getEmails } from './gmail.mjs';
import { readContext, publish, notifyIssue, gh, repository } from './github.mjs';

loadEnv();
const args = process.argv.slice(2);
if (args.length !== 1 || !['--fixture','--once','--watch'].includes(args[0])) throw Error('Usa --fixture, --once o --watch');
const fixture = args[0] === '--fixture';
const publishing = !fixture && process.env.PUBLISH === 'true';
if (args[0] === '--watch' && !publishing) throw Error('Para observar usa PUBLISH=true en el sandbox. Primero revisa --once sin publicar.');

async function previewFixture() {
  const read = path => readJson(resolve(ROOT, path));
  const [email, analysis, project, decision, issue] = await Promise.all([
    read('fixtures/email.json'), read('fixtures/analysis.json'), read('seed/brain/projects/portal-cliente.json'),
    read('seed/brain/decisions/exportacion.json'), read('fixtures/issue.json')
  ]);
  const plan = buildPlan({ email, analysis, project, decision, issue, approvedSender:'client@example.com' });
  await saveJson(resolve(ROOT, 'output/fixture-plan.json'), plan);
  console.log('MODO FIXTURE: correo, Slack, issue y clasificación simulados. No se llama al modelo, Gmail ni GitHub.');
  console.log(JSON.stringify(plan, null, 2));
}
async function runOnce(state) {
  const repo = repository();
  if (state.repo && state.repo !== repo) throw Error('El estado pertenece a otro repositorio; usa otra copia de la demo');
  state.repo = repo;
  // Only one pending proposal: do not supersede a decision while a previous PR is awaiting review.
  if (state.pending) {
    const { plan, number } = state.pending;
    const pr = gh(`repos/${repo}/pulls/${number}`);
    if (!state.pending.notified) {
      notifyIssue(plan, pr, repo); state.pending.notified = true;
      await saveJson(privatePath('state.json'), state);
    }
    if (pr.state === 'open') { console.log(`Esperando revisión de PR #${number}. No se procesan otros cambios.`); return; }
    console.log(`PR #${number}: ${pr.merged_at ? 'fusionado' : 'cerrado sin aplicar'}.`);
    state.pending = null;
    await saveJson(privatePath('state.json'), state);
  }
  const emails = await getEmails();
  for (const email of emails) {
    if (state.processed[email.id]) continue;
    const context = readContext();
    const analysis = await classify({ email, project:context.project, decision:context.decision,
      issue:{number:context.issue.number,title:context.issue.title,body:context.issue.body,state:context.issue.state},
      slack:context.slack, procedure:context.procedure });
    const plan = buildPlan({ email, analysis, ...context, approvedSender:process.env.APPROVED_SENDER });
    await saveJson(resolve(ROOT, `output/${messageKey(email.id)}.json`), plan);
    if (plan.action === 'skip') {
      console.log(`Mensaje ${messageKey(email.id)}: ${plan.reason}`);
      if (publishing) { state.processed[email.id] = {action:'skip'}; await saveJson(privatePath('state.json'), state); }
      continue;
    }
    console.log(`Detectado ${plan.fromFormat} → ${plan.toFormat}. Issue #${plan.issueNumber}.`);
    if (!publishing) { console.log('PREVIEW: propuesta en output/. No se escribió en GitHub.'); continue; }
    const pr = publish(plan, context);
    // Save before commenting; the next poll can recover a failed comment without another PR.
    state.processed[email.id] = {pr:pr.number};
    state.pending = {plan, number:pr.number, notified:false};
    await saveJson(privatePath('state.json'), state);
    notifyIssue(plan, pr, repo);
    state.pending.notified = true;
    await saveJson(privatePath('state.json'), state);
    console.log(`PR creado/reutilizado: ${pr.html_url}. Esperando aprobación humana.`);
    break;
  }
}

if (fixture) await previewFixture();
else {
  for (const key of ['APPROVED_SENDER','GMAIL_LABEL','GMAIL_AFTER','MODEL_API_KEY','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET']) if (!process.env[key]) throw Error(`Falta ${key}`);
  const seconds = Number(process.env.POLL_SECONDS || 30);
  if (!Number.isFinite(seconds) || seconds < 10) throw Error('POLL_SECONDS debe ser >= 10');
  await mkdir(privatePath('.'), {recursive:true, mode:0o700});
  const lockPath = privatePath('watch.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') throw Error('Hay otro proceso o un lock antiguo en .private/watch.lock. Verifica antes de borrarlo.');
    throw error;
  }
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  try {
    let state;
    try { state = await readJson(privatePath('state.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; state = {processed:{},pending:null}; }
    console.log(publishing ? 'PUBLICACIÓN ACTIVADA: solo PR + comentario, nunca merge automático.' : 'PREVIEW REAL: Gmail + modelo; sin escrituras en GitHub.');
    do {
      try { await runOnce(state); } catch (error) {
        if (args[0] !== '--watch') throw error;
        console.error(`Falló la iteración: ${error.message}. Se reintentará; no se marca el mensaje como procesado.`);
      }
      if (args[0] !== '--watch' || stopping) break;
      for (let elapsed = 0; elapsed < seconds && !stopping; elapsed++) await sleep(1000);
    } while (!stopping);
  } finally { await lock.close(); await unlink(lockPath); }
}
