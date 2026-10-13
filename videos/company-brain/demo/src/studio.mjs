import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { ROOT, readJson } from "./common.mjs";
import { getEmails } from "./gmail.mjs";
import { environmentStatus } from "./environment.mjs";
import { createStore } from "./store.mjs";
import { matchesSender } from "./filters.mjs";
import { analyzeMailbox, validateAnalysis, batches, issueDigest, issueVersion } from "./agent.mjs";
import { githubApi, listIssues, listRepositories, applyProposal, writeBody } from "./coordination-github.mjs";

const optional = async path => { try { return await readJson(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; } };
const error = (message, status = 400) => Object.assign(Error(message), { status });

export function createStudio({ root = ROOT, env = { ...process.env }, adapters = {}, scheduler = true, now = () => Date.now() } = {}) {
  const local = path => resolve(root, path);
  let store, initializing, busy = null, inFlight, timer, closing = false, loginProcess;
  let oauth = { status: "idle" };
  const api = {
    emails: project => getEmails({ env, api: adapters.gmail, tokenPath: local(".private/gmail-token.json"), filters: store.filters(project.id), after: project.gmailAfter, label: project.gmailLabel }),
    issues: project => listIssues(project.repository, adapters.github || githubApi),
    analyze: context => analyzeMailbox(context, env, adapters.model || fetch),
    apply: proposal => applyProposal(proposal, adapters.github || githubApi),
    account: () => (adapters.github || githubApi)("user"),
    repositories: () => listRepositories(adapters.github || githubApi),
    ...adapters,
  };
  async function database() {
    if (!initializing) initializing = createStore(root).then(value => {
      store = value;
      if (scheduler && !closing) { timer = setInterval(() => autoTick().catch(() => {}), 10000); timer.unref(); }
      return store;
    });
    return initializing;
  }
  function requireEnvironment(keys) {
    const status = environmentStatus(env);
    const missing = status.missing.filter(key => keys.includes(key));
    const invalid = status.errors.filter(item => keys.includes(item.field));
    if (missing.length) throw error("Faltan variables de entorno: " + missing.join(", ") + ".", 503);
    if (invalid.length) throw error(invalid.map(item => item.message).join(" "), 503);
  }
  async function requireProject(id) {
    await database();
    const project = store.project(id || store.selected());
    if (!project) throw error(id ? "Proyecto no encontrado." : "Crea o selecciona un proyecto para continuar.", 404);
    return project;
  }
  const requireFilters = project => { if (!store.filters(project.id).length) throw error("Añade al menos un correo o dominio a este proyecto."); };
  function errorMessage(problem) {
    let message = String(problem.message || problem).replace(/Bearer\s+[^\s]+/gi, "[credencial]");
    for (const key of ["GOOGLE_CLIENT_SECRET", "MODEL_API_KEY", "GH_TOKEN", "GITHUB_TOKEN"]) if (env[key]) message = message.split(env[key]).join("[credencial]");
    return message.slice(0, 1500);
  }
  async function locked(operation, projectId, action) {
    if (closing) throw error("El servidor se está deteniendo.", 503);
    if (busy) throw error("Hay una operación en curso. Espera a que termine.", 423);
    busy = { operation, projectId };
    const task = (async () => {
      let lock;
      const path = local(".private/watch.lock");
      try {
        await database();
        try { lock = await open(path, "wx", 0o600); }
        catch (problem) { if (problem.code === "EEXIST") throw error("Otra instancia está usando esta demo. Detén el otro servidor o script.", 423); throw problem; }
        return await action();
      } finally {
        if (lock) { await lock.close(); await unlink(path); }
        busy = null;
      }
    })();
    inFlight = task;
    try { return await task; }
    finally { if (inFlight === task) inFlight = null; }
  }
  async function config(projectId) {
    await database();
    const status = environmentStatus(env);
    const project = store.project(projectId || store.selected()) || null;
    const token = await optional(local(".private/gmail-token.json"));
    return {
      ...status, environmentReady: status.ready, project,
      projects: store.projects().map(item => {
        const mails = store.mails(item.id), proposals = store.proposals(item.id), runtime = store.runtime(item.id);
        return { ...item, mailCount: mails.length, unreadCount: mails.filter(mail => !mail.analyzed).length, pendingCount: proposals.filter(proposal => proposal.status === "pending").length, lastSync: runtime.lastSync || null, lastAnalysis: runtime.lastAnalysis || null, error: runtime.error || null };
      }),
      filters: store.filters(), selectedProjectId: store.selected(), busy,
      gmailConnected: Boolean(token?.refresh_token),
      oauth: { ...oauth, ...(oauth.message ? { message: errorMessage(Error(oauth.message)) } : {}) },
      defaultRepository: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPO || "") ? env.GITHUB_REPO : "",
    };
  }
  async function snapshot(projectId) {
    await database();
    const project = projectId ? await requireProject(projectId) : store.project(store.selected());
    if (!project) return { project: null, mails: [], proposals: [], events: [], runtime: {}, links: [] };
    return { project, mails: store.mails(project.id), proposals: store.proposals(project.id), events: store.events(project.id), runtime: store.runtime(project.id), links: store.links(project.id) };
  }
  async function syncProject(project) {
    requireEnvironment(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]); requireFilters(project);
    const result = store.replaceMail(project.id, await api.emails(project));
    store.event(project.id, "Correos sincronizados", result.added + " nuevos o actualizados; " + result.total + " disponibles.");
    return result;
  }
  async function analyzeProject(project) {
    requireEnvironment(["MODEL_BASE_URL", "MODEL_ID", "MODEL_API_KEY"]); requireFilters(project);
    if (!store.runtime(project.id).lastSync) throw error("Sincroniza los correos antes de analizarlos.");
    const issues = await api.issues(project);
    const version = issueDigest(issues);
    const previousVersion = store.runtime(project.id).issueDigest;
    if (previousVersion && previousVersion !== version) store.markUnanalyzed(project.id, store.mails(project.id).map(mail => mail.id));
    for (const item of store.proposals(project.id).filter(item => item.status === "pending")) {
      const target = issues.find(issue => issue.number === item.issueNumber);
      const changed = item.action === "create_issue" ? item.issueDigest !== version : !target || issueVersion(target) !== issueVersion(item.issueSnapshot);
      if (changed) {
        store.setProposal(item.id, "stale", { error: "Los issues cambiaron. Analiza de nuevo." });
        store.markUnanalyzed(project.id, item.sources.map(source => source.id));
      }
    }
    const emails = store.mails(project.id).filter(mail => matchesSender(mail.from, store.filters(project.id)) && Date.parse(mail.date) >= Date.parse(project.gmailAfter));
    const chunks = batches(emails);
    let analyzed = 0, prepared = 0;
    const summaries = [];
    const existingIds = new Set(store.proposals(project.id).map(item => item.id));
    const decisions = store.proposals(project.id).filter(item => ["approved", "rejected"].includes(item.status)).slice(0, 100).map(item => ({ action: item.action, title: item.title, status: item.status, issueNumber: item.result?.number || item.issueNumber, sourceEmailIds: item.sources.map(source => source.id) }));
    for (const batch of chunks) {
      const context = {
        project: { id: project.id, name: project.name, repository: project.repository },
        emails: batch.emails.map(({ id, threadId, from, subject, date, text }) => ({ id, threadId, from, subject, date, text })),
        freshEmailIds: batch.fresh.map(mail => mail.id), issues, links: store.links(project.id), decisions,
        pendingProposals: store.proposals(project.id).filter(item => item.status === "pending").map(item => ({ action: item.action, title: item.title, body: item.body, issueNumber: item.issueNumber, sourceEmailIds: item.sources.map(source => source.id) })),
      };
      const validated = validateAnalysis(await api.analyze(context), { project, emails: batch.emails, fresh: batch.fresh, issues });
      store.transaction(() => {
        for (const data of validated.proposals) {
          const saved = store.saveProposal(data);
          if (!existingIds.has(saved.id)) { prepared++; existingIds.add(saved.id); }
        }
        store.markAnalyzed(project.id, batch.fresh);
      });
      analyzed += batch.fresh.length;
      summaries.push(validated.summary);
    }
    const summary = summaries.join("\n\n") || (emails.length ? "No hay correos nuevos por analizar." : "No hay correos que coincidan con los participantes y la fecha.");
    store.setRuntime(project.id, { issues, issueDigest: version, lastAnalysis: new Date(now()).toISOString(), summary, error: null });
    if (chunks.length) store.event(project.id, "Análisis completado", analyzed + " correos revisados; " + prepared + " propuestas nuevas.");
    return { analyzed, prepared, summary };
  }
  async function recordFailure(project, problem) {
    const message = errorMessage(problem);
    if (store.runtime(project.id).error !== message) store.event(project.id, "Operación pendiente", message);
    store.setRuntime(project.id, { error: message });
  }
  async function sync(projectId) {
    const project = await requireProject(projectId);
    return locked("sync", project.id, async () => {
      try { return await syncProject(project); } catch (problem) { await recordFailure(project, problem); throw problem; }
    });
  }
  async function analyze(projectId) {
    const project = await requireProject(projectId);
    return locked("analyze", project.id, async () => {
      try { return await analyzeProject(project); } catch (problem) { await recordFailure(project, problem); throw problem; }
    });
  }
  async function approve(id, projectId) {
    const project = await requireProject(projectId);
    return locked("approve", project.id, async () => {
      const item = store.proposal(id);
      if (!item || item.projectId !== project.id) throw error("Propuesta no encontrada.", 404);
      if (item.status === "approved") return item.result;
      if (item.status !== "pending") throw error("Esta propuesta ya no está pendiente.", 409);
      const available = new Map(store.mails(project.id).map(mail => [mail.id, mail]));
      if (item.repository !== project.repository || item.sources.some(source => available.get(source.id)?.hash !== source.hash)) throw error("Las fuentes cambiaron. Sincroniza y analiza de nuevo.", 409);
      try {
        const result = await api.apply(item);
        store.transaction(() => {
          store.setProposal(id, "approved", { result });
          for (const source of item.sources) store.link(project.id, source.threadId, result.number);
          const runtime = store.runtime(project.id);
          const issues = (runtime.issues || []).filter(issue => issue.number !== result.number);
          if (result.state === "open") issues.push(result);
          store.setRuntime(project.id, { issues, issueDigest: issueDigest(issues), error: null });
          store.event(project.id, item.action === "create_issue" ? "Issue creado" : "Issue actualizado", "#" + result.number + " · " + result.title);
        });
        return result;
      } catch (problem) {
        if (problem.stale) { store.setProposal(id, "stale", { error: errorMessage(problem) }); store.markUnanalyzed(project.id, item.sources.map(source => source.id)); }
        else store.setProposal(id, "pending", { error: errorMessage(problem) });
        throw problem;
      }
    });
  }
  async function reject(id, projectId) {
    const project = await requireProject(projectId);
    return locked("reject", project.id, () => {
      const item = store.proposal(id);
      if (!item || item.projectId !== project.id) throw error("Propuesta no encontrada.", 404);
      if (item.status !== "pending") throw error("Esta propuesta ya no está pendiente.", 409);
      store.setProposal(id, "rejected");
      store.event(project.id, "Propuesta rechazada", item.title);
      return { rejected: true };
    });
  }
  async function autoTick() {
    if (closing || busy) return;
    await database();
    for (const project of store.projects().filter(project => project.autoEnabled)) {
      if (closing || busy) return;
      const runtime = store.runtime(project.id);
      const delay = (runtime.error ? Math.max(project.pollSeconds, 300) : project.pollSeconds) * 1000;
      if (runtime.lastAutoAttempt && now() - runtime.lastAutoAttempt < delay) continue;
      try {
        await locked("automatic", project.id, async () => {
          store.setRuntime(project.id, { lastAutoAttempt: now() });
          try { await syncProject(project); await analyzeProject(project); }
          catch (problem) { await recordFailure(project, problem); }
        });
      } catch (problem) { if (problem.status !== 423) throw problem; }
    }
  }
  async function login() {
    requireEnvironment(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
    if (loginProcess || busy) throw error("Hay una operación en curso. Espera a que termine.", 423);
    oauth = { status: "starting" };
    loginProcess = spawn(process.execPath, [local("src/gmail-login.mjs")], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    const child = loginProcess; let output = "", errors = "";
    child.stdout.on("data", data => {
      output += data.toString();
      const url = output.match(/https:\/\/accounts\.google\.com\/[^\s]+/);
      if (url) oauth = { status: "waiting", url: url[0] };
      if (output.includes("Refresh token guardado")) oauth = { status: "connected" };
    });
    child.stderr.on("data", data => { errors += data.toString().slice(0, 1500); });
    child.on("error", () => { oauth = { status: "error", message: "No se pudo iniciar la conexión. Revisa las credenciales de Google." }; loginProcess = null; });
    child.on("exit", () => {
      if (oauth.status !== "connected") oauth = { status: "error", message: errors.trim().slice(0, 1000) || "La conexión no se completó. Inténtalo de nuevo." };
      loginProcess = null;
    });
    return oauth;
  }
  if (scheduler) database().catch(() => {});
  return {
    config, snapshot, sync, analyze, approve, reject, login, errorMessage, autoTick,
    async proposalDetail(id, projectId) {
      const project = await requireProject(projectId);
      const item = store.proposal(id);
      if (!item || item.projectId !== project.id) throw error("Propuesta no encontrada.", 404);
      return { ...item, previewBody: writeBody(item) };
    },
    saveProject: input => locked("save", input.id, () => store.saveProject(input)),
    saveFilter: input => locked("save", input.projectId, () => store.addFilter(input)),
    removeFilter: (id, projectId) => locked("save", projectId, () => store.removeFilter(id, projectId)),
    selectProject: id => locked("select", id, () => { store.select(id); return { projectId: id }; }),
    async automation(projectId, enabled, pollSeconds) {
      const project = await requireProject(projectId);
      if (typeof enabled !== "boolean") throw error("Seguimiento automático inválido.");
      const saved = store.saveProject({ ...project, autoEnabled: enabled, pollSeconds: pollSeconds ?? project.pollSeconds });
      if (enabled) store.setRuntime(projectId, { lastAutoAttempt: null });
      store.event(projectId, enabled ? "Seguimiento activado" : "Seguimiento pausado", "Intervalo: " + saved.pollSeconds + " segundos. Las propuestas requieren aprobación.");
      return saved;
    },
    deleteProject: (id, confirmation) => locked("delete", id, () => { if (confirmation !== id) throw error("Confirma el proyecto que quieres eliminar."); store.deleteProject(id); return { deleted: true }; }),
    reset: confirmation => locked("reset", null, () => { if (confirmation !== "RESET_LOCAL_DATA") throw error("Confirma el reinicio de los datos locales."); return store.reset(); }),
    repositories: () => api.repositories(),
    github: async () => { const actor = await api.account(); return { login: actor.login, html_url: actor.html_url }; },
    close: async () => { closing = true; clearInterval(timer); loginProcess?.kill(); if (inFlight) await inFlight.catch(() => {}); if (initializing) { try { (await initializing).close(); } catch { store?.close(); } } },
  };
}
