import { spawnSync } from "node:child_process";
import { issueFingerprint } from "./plan.mjs";

export function gh(path, { method = "GET", body } = {}) {
  const args = ["api", path, "--method", method];
  if (body) args.push("--input", "-");
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input: body ? JSON.stringify(body) : undefined,
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw Error(`GitHub ${method} ${path}: ${result.error?.message || result.stderr.trim()}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
export function repository(env = process.env) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPO || ""))
    throw Error("GITHUB_REPO debe ser owner/repo");
  return env.GITHUB_REPO;
}
export function readIssue(env = process.env, api = gh) {
  const repo = repository(env),
    number = Number(env.GITHUB_ISSUE_NUMBER);
  if (!Number.isSafeInteger(number) || number < 1) throw Error("GITHUB_ISSUE_NUMBER inválido");
  const issue = api(`repos/${repo}/issues/${number}`);
  if (issue.pull_request || issue.number !== number)
    throw Error("Se esperaba el issue configurado, no un PR");
  const { title, body, state, html_url } = issue;
  return { number, title, body: body || "", state, html_url };
}
// El ejemplo por terminal solo publica comentarios en el issue configurado.
export function publishComment(plan, env = process.env, api = gh) {
  const repo = repository(env),
    number = Number(env.GITHUB_ISSUE_NUMBER);
  if (
    plan.action !== "comment" ||
    plan.issueNumber !== number ||
    !Number.isSafeInteger(number) ||
    number < 1 ||
    !/^[a-f0-9]{20}$/.test(plan.key)
  )
    throw Error("Comentario fuera del alcance");
  const marker = `<!-- company-brain-request:${plan.key} -->`;
  if (!plan.body.startsWith(marker) || plan.body.length > 30000)
    throw Error("Cuerpo de comentario inválido");
  const actor = api("user");
  if (!Number.isSafeInteger(actor.id)) throw Error("No se pudo identificar la cuenta GitHub");
  for (let page = 1; ; page++) {
    const comments = api(`repos/${repo}/issues/${number}/comments?per_page=100&page=${page}`);
    const existing = comments.find((c) => c.user?.id === actor.id && c.body?.startsWith(marker));
    if (existing) return { ...existing, reused: true };
    if (comments.length < 100) break;
  }
  const current = readIssue(env, api);
  if (issueFingerprint(current) !== plan.issueFingerprint)
    throw Error("El issue cambió durante el análisis; reintenta con contexto actualizado");
  return api(`repos/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: { body: plan.body },
  });
}
