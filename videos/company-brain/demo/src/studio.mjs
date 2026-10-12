import { writeFile, mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { ROOT, readJson, saveJson } from "./common.mjs";
import { createBaseline, classify, messageKey, issueFingerprint } from "./plan.mjs";
import { getEmails } from "./gmail.mjs";
import { gh, readIssue, publishComment } from "./github.mjs";
import { assertBaseline, processEmails } from "./pipeline.mjs";
import { environmentStatus } from "./environment.mjs";
import { createStore, projectContext, validateProject } from "./store.mjs";
import { normalizeFilter, senderProjects } from "./filters.mjs";

const optional = async path => {
  try { return await readJson(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};

export function createStudio({ root = ROOT, env = { ...process.env }, adapters = {} } = {}) {
  const local = path => resolve(root, path);
  const destination = project => ({ ...env, GITHUB_REPO: project.repository, GITHUB_ISSUE_NUMBER: String(project.issueNumber) });
  let store, initializing, busy = false, loginProcess;
  let oauth = { status: "idle" };
  const api = {
    emails: () => getEmails({ env, filters: store.filters() }),
    issue: project => readIssue(destination(project)),
    analyze: context => classify(context, env),
    publish: (plan, project) => publishComment(plan, destination(project)),
    account: () => gh("user"), ...adapters,
  };
  async function database() {
    if (!initializing) initializing = (async () => {
      store = await createStore(root);
      // Import only an explicitly configured legacy destination. Never seed a demo project.
      if (!store.metadata("legacy_imported")) {
        if (store.projects().length) store.setMetadata("legacy_imported", "true");
        else if (env.GITHUB_REPO && env.GITHUB_ISSUE_NUMBER && env.ALLOWED_SENDER) {
          const context = await readJson(local("config/project.json"));
          const project = validateProject({ id: context.id, name: context.name, delivery: context.delivery, requirement: context.requirement, repository: env.GITHUB_REPO, issueNumber: env.GITHUB_ISSUE_NUMBER });
          const filter = normalizeFilter("email", env.ALLOWED_SENDER);
          const saved = await optional(local(".private/baseline.json"));
          const state = await optional(local(".private/state.json"));
          if (saved) {
            assertBaseline(saved, project.repository, project.issueNumber);
            if (JSON.stringify(saved.project) !== JSON.stringify(projectContext(project))) throw Error("La configuración del proyecto cambió desde la captura inicial.");
          }
          if (state && (state.schemaVersion !== 2 || state.repo !== project.repository || state.issueNumber !== project.issueNumber)) throw Error("El estado pertenece a otro destino. Utiliza otra copia de la demo.");
          store.transaction(() => {
            store.saveProject(projectFields(project));
            store.addFilter({ projectId: project.id, ...filter });
            if (saved) store.saveBaseline(project.id, saved);
            for (const [emailId, result] of Object.entries(state?.processed || {})) {
              store.saveRecord(project.id, emailId, { requestEmail: { id: emailId }, plan: { action: result.action } });
              store.publish(project.id, emailId, result);
            }
            store.setMetadata("legacy_project", project.id);
            store.setMetadata("legacy_imported", "true");
          });
        }
      }
      return store;
    })();
    return initializing;
  }
  const projectFields = ({ id, name, repository, issueNumber, delivery, requirement }) => ({ id, name, repository, issueNumber, delivery, requirement });
  const requireEnvironment = () => {
    const status = environmentStatus(env);
    if (!status.ready) throw Object.assign(Error(status.error), { status: 503 });
  };
  async function requireProject(id) {
    await database();
    const project = store.project(id || store.selected());
    if (!project) throw Error("Crea o selecciona un proyecto para continuar.");
    return project;
  }
  const rulesFor = id => store.filters().filter(rule => rule.projectId === id);
  function resolvedProject(email) {
    const candidates = senderProjects(email.from, store.filters());
    if (candidates.length === 1) return candidates[0];
    const assigned = store.assignment(email.id);
    return candidates.includes(assigned) ? assigned : null;
  }
  function partition(emails, projectId) {
    const projects = store.projects();
    const ambiguous = [];
    const matched = [];
    for (const email of emails) {
      const candidates = senderProjects(email.from, store.filters());
      const selected = resolvedProject(email);
      if (selected === projectId) matched.push(email);
      else if (!selected && candidates.length > 1 && candidates.includes(projectId)) ambiguous.push({ ...email, projects: projects.filter(project => candidates.includes(project.id)).map(({ id, name }) => ({ id, name })) });
    }
    return { emails: matched, ambiguous };
  }
  function requireRules(project) {
    if (!rulesFor(project.id).length) throw Error("Añade al menos un correo o dominio a este proyecto.");
  }
  function errorMessage(error) {
    let message = String(error.message || error).replace(/(?:Bearer\s+)[^\s]+/gi, "[credencial]");
    for (const key of ["GOOGLE_CLIENT_SECRET", "MODEL_API_KEY"]) if (env[key]) message = message.split(env[key]).join("[credencial]");
    return message;
  }
  async function locked(action) {
    if (busy) throw Error("Hay una operación en curso. Espera a que termine.");
    busy = true;
    let lock;
    const path = local(".private/watch.lock");
    try {
      await database();
      try { lock = await open(path, "wx", 0o600); }
      catch (error) { if (error.code === "EEXIST") throw Error("Otra instancia está usando esta demo. Detén el script o servidor anterior antes de continuar."); throw error; }
      return await action();
    } finally { if (lock) { await lock.close(); await unlink(path); } busy = false; }
  }
  function baseline(project) {
    const saved = store.baseline(project.id);
    if (saved) assertBaseline(saved, project.repository, project.issueNumber);
    return saved;
  }
  async function config(projectId) {
    await database();
    const status = environmentStatus(env);
    const project = store.project(projectId || store.selected()) || null;
    const filters = store.filters();
    const token = await optional(local(".private/gmail-token.json"));
    const ready = status.ready && Boolean(project) && rulesFor(project.id).length > 0;
    return {
      ...status, ready, environmentReady: status.ready,
      error: status.error || (!project ? "Crea o selecciona un proyecto para continuar." : !rulesFor(project.id).length ? "Añade al menos un correo o dominio a este proyecto." : null),
      project: project && projectContext(project), projects: store.projects().map(item => ({ ...item, captured: Boolean(store.baseline(item.id)) })), filters,
      repository: project?.repository || "", issueNumber: project?.issueNumber || null,
      connections: { ...status.connections, github: Boolean(project) },
      gmailConnected: Boolean(token?.refresh_token), baseline: project && baseline(project),
      oauth: { ...oauth, ...(oauth.message ? { message: errorMessage(Error(oauth.message)) } : {}) }, events: project ? store.events(project.id) : [],
    };
  }
  function entries(project, issue) {
    return store.records(project.id).filter(entry => entry.issue && entry.requestEmail?.from && resolvedProject(entry.requestEmail) === project.id && issueFingerprint(entry.issue) === issueFingerprint(issue));
  }
  function view(project, issue, saved) {
    const records = entries(project, issue);
    const proposals = records.filter(entry => entry.plan.action === "comment" && !entry.published);
    const workspace = proposals.at(-1) || records.at(-1) || { project: projectContext(project), initialEmail: saved.initialEmail, issue, requestEmail: null, analysis: null, plan: null };
    return { workspace, proposals, events: store.events(project.id) };
  }
  async function snapshot(projectId) {
    requireEnvironment();
    const project = await requireProject(projectId); requireRules(project);
    const saved = baseline(project);
    if (!saved) return { workspace: null, proposals: [], events: store.events(project.id) };
    return view(project, await api.issue(project), saved);
  }
  async function workspace(projectId) { return (await snapshot(projectId)).workspace; }
  async function inbox(projectId) {
    requireEnvironment();
    const project = await requireProject(projectId); requireRules(project);
    return locked(async () => partition(await api.emails(), project.id));
  }
  async function capture(id, projectId) {
    requireEnvironment();
    const project = await requireProject(projectId); requireRules(project);
    return locked(async () => {
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw Error("ID de correo inválido.");
      if (store.metadata("legacy_project") === project.id && env.GMAIL_INITIAL_MESSAGE_ID && env.GMAIL_INITIAL_MESSAGE_ID !== id) throw Error("El correo seleccionado no coincide con GMAIL_INITIAL_MESSAGE_ID. Actualiza el entorno y reinicia el servidor.");
      const previous = baseline(project);
      if (previous) { if (id !== previous.initialEmail.id) throw Error("Ya existe un contexto inicial. No se puede reemplazar desde esta sesión."); return previous; }
      const email = partition(await api.emails(), project.id).emails.find(item => item.id === id);
      if (!email) throw Error("Ese correo no está asignado a este proyecto. Revisa los filtros o su asignación.");
      const issue = await api.issue(project);
      const context = { project: projectContext(project), initialEmail: email, issue, requestEmail: null };
      const analysis = await api.analyze(context);
      await saveJson(local(`output/${project.id}/initial-context.json`), { context, analysis });
      const saved = createBaseline({ repo: project.repository, project: projectContext(project), email, issue, analysis, sender: rulesFor(project.id) });
      store.saveBaseline(project.id, saved);
      store.event(project.id, "Acuerdo inicial capturado", `Correo e issue coinciden en ${saved.initialFormat}.`);
      return saved;
    });
  }
  async function run(mode, projectId) {
    if (mode !== undefined) throw Error("La interfaz solo admite datos reales.");
    requireEnvironment();
    const project = await requireProject(projectId); requireRules(project);
    return locked(async () => {
      const saved = baseline(project);
      if (!saved) throw Error("Selecciona el correo inicial y captura el acuerdo desde Conexiones.");
      const mailbox = partition(await api.emails(), project.id);
      if (!mailbox.emails.some(email => email.id === saved.initialEmail.id)) throw Error("El acuerdo inicial no aparece entre los correos asignados a este proyecto. Revisa filtros, etiqueta y fecha.");
      const issue = await api.issue(project);
      const current = entries(project, issue);
      const processed = Object.fromEntries(store.records(project.id).filter(entry => entry.published).map(entry => [entry.requestEmail.id, entry.published]));
      const state = { processed };
      await processEmails({
        baseline: saved, emails: mailbox.emails.filter(email => !current.some(entry => entry.requestEmail.id === email.id)), state,
        publishing: false, sender: rulesFor(project.id), readIssue: () => issue, analyze: api.analyze,
        publish: () => { throw Error("La publicación necesita el botón de revisión."); },
        persist: () => { throw Error("Un análisis no marca correos como publicados."); },
        onPlan: async ({ email, context, analysis, plan }) => {
          const entry = { project: projectContext(project), initialEmail: saved.initialEmail, requestEmail: email, issue, analysis, plan };
          await saveJson(local(`output/${project.id}/${messageKey(email.id)}.json`), { context, analysis, plan });
          if (plan.action === "comment") await writeFile(local(`output/${project.id}/${messageKey(email.id)}-comment.md`), plan.body + "\n", { mode: 0o600 });
          store.saveRecord(project.id, email.id, entry);
          store.event(project.id, plan.action === "comment" ? "Propuesta preparada" : "Correo revisado", plan.action === "comment" ? `${plan.fromFormat} a ${plan.toFormat}. Pendiente de revisión.` : plan.reason);
        },
      });
      return { ...view(project, issue, saved), ambiguous: mailbox.ambiguous };
    });
  }
  async function publish(key, projectId) {
    requireEnvironment();
    const project = await requireProject(projectId); requireRules(project);
    return locked(async () => {
      if (!baseline(project)) throw Error("Falta el acuerdo inicial. Captúralo antes de publicar.");
      const entry = store.records(project.id).find(item => item.plan.key === key);
      if (!entry || entry.plan.action !== "comment" || resolvedProject(entry.requestEmail) !== project.id) throw Error("Vuelve a analizar la solicitud antes de publicar.");
      if (entry.published) return entry.published;
      const comment = await api.publish(entry.plan, project);
      const result = { action: "comment", id: comment.id, url: comment.html_url };
      store.publish(project.id, entry.requestEmail.id, result);
      store.event(project.id, "Comentario publicado", `Issue #${entry.issue.number}. El cambio sigue pendiente de decisión humana.`);
      return result;
    });
  }
  async function saveProject(input) {
    return locked(() => { const project = store.saveProject(input); store.select(project.id); store.setMetadata("legacy_imported", "true"); return project; });
  }
  async function saveFilter(input) { return locked(() => store.addFilter(input)); }
  async function removeFilter(id, projectId) { return locked(() => store.removeFilter(id, projectId)); }
  async function selectProject(id) { return locked(() => store.select(id)); }
  async function assign(id, projectId) {
    requireEnvironment();
    const project = await requireProject(projectId);
    return locked(async () => {
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw Error("ID de correo inválido.");
      const email = (await api.emails()).find(item => item.id === id);
      if (!email || !senderProjects(email.from, store.filters()).includes(project.id)) throw Error("Ese correo no coincide con los filtros de este proyecto.");
      store.assign(id, project.id);
      return { projectId: project.id };
    });
  }
  async function login() {
    requireEnvironment();
    if (loginProcess || busy) throw Error("Ya hay una operación en curso.");
    oauth = { status: "starting" };
    loginProcess = spawn(process.execPath, [local("src/gmail-login.mjs")], { env, stdio: ["ignore", "pipe", "pipe"] });
    const child = loginProcess;
    let output = "", errors = "";
    child.stderr.on("data", data => { errors += data.toString(); });
    child.stdout.on("data", data => {
      output += data.toString();
      const url = output.match(/https:\/\/accounts\.google\.com\/[^\s]+/);
      if (url) oauth = { status: "waiting", url: url[0] };
      if (output.includes("Refresh token guardado")) oauth = { status: "connected" };
    });
    child.on("error", () => { oauth = { status: "error", message: "No se pudo iniciar la conexión. Revisa las credenciales de Google." }; loginProcess = null; });
    child.on("exit", () => {
      if (oauth.status !== "connected") oauth = { status: "error", message: errors.trim().slice(0, 500) || "La conexión no se completó. Inténtalo de nuevo." };
      if (oauth.status === "connected" && store?.selected()) store.event(store.selected(), "Gmail conectado", "Acceso de lectura autorizado.");
      loginProcess = null;
    });
    return oauth;
  }
  return { config, workspace, snapshot, inbox, capture, run, publish, login, errorMessage, saveProject, saveFilter, removeFilter, selectProject, assign,
    github: async () => { requireEnvironment(); const actor = await api.account(); return { login: actor.login, url: actor.html_url }; },
    close: async () => { loginProcess?.kill(); if (initializing) { try { (await initializing).close(); } catch { store?.close(); } } },
  };
}
