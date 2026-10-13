import { spawn } from "node:child_process";
import { issueDigest, issueVersion } from "./agent.mjs";
import { safeText } from "./plan.mjs";

export function githubApi(path, { method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const args = ["api", path, "--method", method];
    if (body) args.push("--input", "-");
    const child = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", failure;
    const timer = setTimeout(() => { failure = Error("GitHub agotó el tiempo de espera."); child.kill(); }, 30000);
    child.on("error", error => { clearTimeout(timer); reject(Error("No se pudo ejecutar GitHub CLI: " + error.message)); });
    child.stdout.on("data", data => { stdout += data; if (Buffer.byteLength(stdout) > 8 * 1024 * 1024) { failure = Error("Respuesta de GitHub demasiado grande."); child.kill(); } });
    child.stderr.on("data", data => { stderr += data; if (stderr.length > 100000) { failure = Error("Error de GitHub demasiado grande."); child.kill(); } });
    child.on("close", code => {
      clearTimeout(timer);
      if (failure || code !== 0) return reject(failure || Error("GitHub " + method + ": " + stderr.trim()));
      try { resolve(stdout.trim() ? JSON.parse(stdout) : null); }
      catch { reject(Error("GitHub devolvió una respuesta inválida.")); }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(body ? JSON.stringify(body) : "");
  });
}
const repoName = repo => { if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || "")) throw Error("Repositorio inválido."); return repo; };
export function normalizeIssue(issue) {
  if (!issue || issue.pull_request || !Number.isSafeInteger(issue.number) || issue.number < 1 || typeof issue.title !== "string" || !["open", "closed"].includes(issue.state)) throw Error("GitHub no devolvió un issue válido.");
  return { number: issue.number, title: issue.title, body: issue.body || "", state: issue.state, html_url: issue.html_url || "", userId: issue.user?.id || issue.userId || null };
}
export async function listIssues(repo, api = githubApi, state = "open") {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const rows = await api("repos/" + repoName(repo) + "/issues?state=" + state + "&per_page=100&page=" + page);
    if (!Array.isArray(rows)) throw Error("Lista de issues inválida.");
    all.push(...rows.filter(row => !row.pull_request).map(normalizeIssue));
    if (all.length > 500) throw Error("Más de 500 issues: usa un repositorio más acotado para esta demo.");
    if (rows.length < 100) return all;
  }
  throw Error("Demasiadas páginas de GitHub: usa un repositorio más acotado para esta demo.");
}
export async function listRepositories(api = githubApi) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const rows = await api("user/repos?per_page=100&sort=updated&page=" + page);
    if (!Array.isArray(rows)) throw Error("Lista de repositorios inválida.");
    all.push(...rows.map(repo => ({ name: repo.full_name, private: Boolean(repo.private) })).filter(repo => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.name)));
    if (rows.length < 100) break;
  }
  return all;
}
export async function getIssue(repo, number, api = githubApi) {
  if (!Number.isSafeInteger(number) || number < 1) throw Error("Número de issue inválido.");
  const issue = normalizeIssue(await api("repos/" + repoName(repo) + "/issues/" + number));
  if (issue.number !== number) throw Error("GitHub devolvió otro issue.");
  return issue;
}
const stale = message => Object.assign(Error(message), { status: 409, stale: true });
export function writeBody(proposal) {
  const marker = "<!-- company-brain-proposal:" + proposal.id + " -->";
  const previousMarkers = proposal.issueSnapshot?.body.match(/<!-- company-brain-proposal:[a-f0-9-]+ -->/g) || [];
  const body = proposal.body.replace(/<!-- company-brain-proposal:[^>]+ -->/g, "").trim();
  const evidence = proposal.evidence.map(entry => {
    const source = proposal.sources.find(source => source.id === entry.emailId);
    return safeText(source.from) + " · " + safeText(source.date) + "\n" + entry.quote.split("\n").map(line => "> " + safeText(line)).join("\n");
  }).join("\n\n");
  const result = body + "\n\n## Fuentes de Company Brain\n\n" + evidence + "\n\n" + [...new Set([...previousMarkers, marker])].join("\n");
  if (result.length > 60000) throw Error("El issue supera el tamaño admitido.");
  return result;
}
export async function applyProposal(proposal, api = githubApi) {
  if (!/^[a-f0-9-]{36}$/.test(proposal.id) || !["create_issue", "update_issue"].includes(proposal.action)) throw Error("Propuesta inválida.");
  const repo = repoName(proposal.repository), marker = "<!-- company-brain-proposal:" + proposal.id + " -->";
  if (proposal.action === "create_issue") {
    const actor = await api("user");
    if (!Number.isSafeInteger(actor?.id)) throw Error("No se pudo identificar la cuenta GitHub.");
    const all = await listIssues(repo, api, "all");
    const previous = all.find(issue => issue.userId === actor.id && issue.body.includes(marker));
    if (previous) return { ...previous, reused: true };
    if (issueDigest(all.filter(issue => issue.state === "open")) !== proposal.issueDigest) throw stale("Los issues cambiaron. Analiza los correos de nuevo antes de aprobar.");
    return normalizeIssue(await api("repos/" + repo + "/issues", { method: "POST", body: { title: proposal.title, body: writeBody(proposal) } }));
  }
  const current = await getIssue(repo, proposal.issueNumber, api);
  if (current.body.includes(marker)) return { ...current, reused: true };
  if (current.state !== "open" || issueVersion(current) !== issueVersion(proposal.issueSnapshot)) throw stale("El issue cambió. Analiza los correos de nuevo antes de aprobar.");
  return normalizeIssue(await api("repos/" + repo + "/issues/" + proposal.issueNumber, { method: "PATCH", body: { title: proposal.title, body: writeBody(proposal) } }));
}
