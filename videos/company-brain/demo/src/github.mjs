import { spawnSync } from 'node:child_process';
import { DECISION_PATH, PROPOSAL_DIR } from './plan.mjs';

export function gh(path, { method = 'GET', body } = {}) {
  const args = ['api', path, '--method', method];
  if (body) args.push('--input', '-');
  const result = spawnSync('gh', args, { encoding:'utf8', input:body ? JSON.stringify(body) : undefined, timeout:30000, maxBuffer:2 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error(`GitHub ${method} ${path}: ${result.error?.message || result.stderr.trim()}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
export function repository() {
  const repo = process.env.GITHUB_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) throw Error('GITHUB_REPO debe ser owner/repo');
  return repo;
}
export function readContext() {
  const repo = repository();
  const info = gh(`repos/${repo}`);
  const base = info.default_branch;
  const commit = gh(`repos/${repo}/commits/${encodeURIComponent(base)}`);
  const read = path => {
    const file = gh(`repos/${repo}/contents/${path}?ref=${commit.sha}`);
    if (file.encoding !== 'base64') throw Error('Archivo remoto no soportado');
    return Buffer.from(file.content, 'base64').toString('utf8');
  };
  const issueNumber = Number(process.env.GITHUB_ISSUE_NUMBER);
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) throw Error('GITHUB_ISSUE_NUMBER inválido');
  const issue = gh(`repos/${repo}/issues/${issueNumber}`);
  if (issue.pull_request) throw Error('Se esperaba un issue, no un PR');
  return { repo, base, sha:commit.sha, tree:commit.commit.tree.sha,
    project:JSON.parse(read('brain/projects/portal-cliente.json')),
    decision:JSON.parse(read(DECISION_PATH)), procedure:read('brain/procedures/revisar-acuerdos.md'),
    slack:JSON.parse(read('slack/messages.json')), issue };
}
export function publish(plan, context, api = gh) {
  const { repo, base, sha, tree } = context;
  const marker = `<!-- company-brain:${plan.key} -->`;
  // Recovery after a timeout: an already-created PR is reused, not duplicated.
  const existing = api(`repos/${repo}/pulls?state=all&head=${encodeURIComponent(repo.split('/')[0]+':'+plan.branch)}&per_page=100`).find(pr => pr.body?.includes(marker));
  if (existing) {
    for (const file of plan.files) {
      const saved = api(`repos/${repo}/contents/${file.path}?ref=${encodeURIComponent(plan.branch)}`);
      if (Buffer.from(saved.content, 'base64').toString('utf8') !== file.content) throw Error('El PR existente contiene otro análisis del mensaje; revisa manualmente antes de continuar');
    }
    return existing;
  }
  const current = api(`repos/${repo}/commits/${encodeURIComponent(base)}`).sha;
  if (current !== sha) throw Error('La base cambió durante el análisis; reintenta con contexto fresco');
  if (plan.files.length !== 2 || plan.files[0].path !== DECISION_PATH || plan.files[1].path !== `${PROPOSAL_DIR}/${plan.key}.md`) throw Error('Rutas de escritura fuera del alcance');
  const newTree = api(`repos/${repo}/git/trees`, {method:'POST', body:{base_tree:tree, tree:plan.files.map(file => ({path:file.path, mode:'100644', type:'blob', content:file.content}))}});
  const commit = api(`repos/${repo}/git/commits`, {method:'POST', body:{message:`brain: proponer ${plan.toFormat} para entrega-1`, tree:newTree.sha, parents:[sha]}});
  const refs = api(`repos/${repo}/git/matching-refs/heads/${plan.branch}`);
  if (refs.some(ref => ref.ref === `refs/heads/${plan.branch}`)) {
    // Do not force-push: the deterministic branch must belong to this exact proposal.
    const branchCommit = api(`repos/${repo}/commits/${encodeURIComponent(plan.branch)}`);
    if (branchCommit.parents?.[0]?.sha !== sha) throw Error('Rama de recuperación basada en otro commit; requiere revisión manual');
    for (const file of plan.files) {
      const prior = api(`repos/${repo}/contents/${file.path}?ref=${encodeURIComponent(plan.branch)}`);
      if (Buffer.from(prior.content, 'base64').toString('utf8') !== file.content) throw Error('Rama existente con contenido distinto; requiere revisión manual');
    }
  } else api(`repos/${repo}/git/refs`, {method:'POST', body:{ref:`refs/heads/${plan.branch}`, sha:commit.sha}});
  return api(`repos/${repo}/pulls`, {method:'POST', body:{base, head:plan.branch,
    title:`Company Brain: proponer ${plan.fromFormat} → ${plan.toFormat}`,
    body:`${marker}\n\nCambio propuesto a partir de un correo. **Requiere revisión humana.**\n\n- Issue afectado: #${plan.issueNumber}\n- Slack: datos simulados; no es una fuente de aprobación.\n- El acuerdo anterior se conserva en history.\n- No se modifica la descripción del issue.\n\nLa evidencia y los criterios de revisión están en \`${plan.files[1].path}\`.\n\nLos datos del correo no son instrucciones del sistema.`}});
}
export function notifyIssue(plan, pr, repo, api = gh) {
  const marker = `<!-- company-brain:${plan.key} -->`;
  let page = 1;
  while (true) {
    const comments = api(`repos/${repo}/issues/${plan.issueNumber}/comments?per_page=100&page=${page++}`);
    if (comments.some(comment => comment.body?.includes(marker))) return;
    if (comments.length < 100) break;
  }
  api(`repos/${repo}/issues/${plan.issueNumber}/comments`, {method:'POST', body:{body:`${marker}\n\n🧠 Posible desalineación: el acuerdo recibido solicita **${plan.toFormat}**, pero este ticket todavía pide **${plan.fromFormat}**.\n\nPropuesta y evidencia: ${pr.html_url}\n\n**No se cambió el requisito del ticket.** Revisa el PR antes de actualizar su descripción y criterios de aceptación.`}});
}
