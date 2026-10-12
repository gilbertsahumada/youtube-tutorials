import { writeFile, mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { ROOT, readJson, saveJson } from "./common.mjs";
import { createBaseline, classify, messageKey, issueFingerprint } from "./plan.mjs";
import { getEmails } from "./gmail.mjs";
import { gh, repository, readIssue, publishComment } from "./github.mjs";
import { assertBaseline, processEmails } from "./pipeline.mjs";
import { environmentStatus } from "./environment.mjs";

const optional = async path => {
  try { return await readJson(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};

// The browser selects an action; the existing pipeline owns validation and writes.
export function createStudio({ root = ROOT, env = { ...process.env }, adapters = {} } = {}) {
  const local = path => resolve(root, path);
  const api = {
    emails: () => getEmails({ env }),
    issue: () => readIssue(env),
    analyze: context => classify(context, env),
    publish: plan => publishComment(plan, env),
    account: () => gh("user"),
    ...adapters,
  };
  let busy = false;
  let oauth = { status: "idle" };
  let loginProcess;
  const pending = new Map();
  const events = [];
  const event = (title, detail) => events.unshift({ title, detail, date: new Date().toISOString() });
  const requireEnvironment = () => {
    const status = environmentStatus(env);
    if (!status.ready) throw Object.assign(Error(status.error), { status: 503 });
  };
  function errorMessage(error) {
    let message = error.message.replace(/(?:Bearer\s+)[^\s]+/gi, "[credencial]");
    for (const key of ["GOOGLE_CLIENT_SECRET", "MODEL_API_KEY"]) if (env[key]) message = message.split(env[key]).join("[credencial]");
    return message;
  }
  async function locked(action) {
    if (busy) throw Error("Hay una operación en curso. Espera a que termine.");
    busy = true;
    let lock;
    const path = local(".private/watch.lock");
    try {
      await mkdir(local(".private"), { recursive: true, mode: 0o700 });
      try { lock = await open(path, "wx", 0o600); }
      catch (error) {
        if (error.code === "EEXIST") throw Error("Otra instancia está usando esta demo. Detén el script o servidor anterior antes de continuar.");
        throw error;
      }
      return await action();
    } finally {
      if (lock) { await lock.close(); await unlink(path); }
      busy = false;
    }
  }
  async function baseline() {
    const saved = await optional(local(".private/baseline.json"));
    if (!saved) return null;
    assertBaseline(saved, repository(env), Number(env.GITHUB_ISSUE_NUMBER));
    if (env.GMAIL_INITIAL_MESSAGE_ID && saved.initialEmail.id !== env.GMAIL_INITIAL_MESSAGE_ID) throw Error("El correo inicial cambió. Conserva la configuración de esta demo o utiliza otra copia.");
    const project = await readJson(local("config/project.json"));
    if (JSON.stringify(saved.project) !== JSON.stringify(project)) throw Error("La configuración del proyecto cambió desde la captura inicial.");
    return saved;
  }
  async function processedState() {
    const state = await optional(local(".private/state.json")) || {
      schemaVersion: 2, repo: repository(env), issueNumber: Number(env.GITHUB_ISSUE_NUMBER), processed: {},
    };
    if (state.schemaVersion !== 2 || state.repo !== repository(env) || state.issueNumber !== Number(env.GITHUB_ISSUE_NUMBER)) throw Error("El estado pertenece a otro destino. Utiliza otra copia de la demo.");
    return state;
  }
  async function config() {
    const token = await optional(local(".private/gmail-token.json"));
    const saved = await optional(local(".private/baseline.json"));
    const project = await readJson(local("config/project.json"));
    return {
      ...environmentStatus(env), project,
      repository: env.GITHUB_REPO || "", issueNumber: Number(env.GITHUB_ISSUE_NUMBER) || null,
      gmailConnected: Boolean(token?.refresh_token), baseline: saved,
      oauth: { ...oauth, ...(oauth.message ? { message: errorMessage(Error(oauth.message)) } : {}) }, events: events.slice(0, 30),
    };
  }
  async function workspace() {
    requireEnvironment();
    const saved = await baseline();
    if (!saved) return null;
    const issue = await api.issue();
    return { project: saved.project, initialEmail: saved.initialEmail, issue, requestEmail: null, analysis: null, plan: null };
  }
  async function inbox() {
    requireEnvironment();
    return locked(() => api.emails());
  }
  async function capture(id) {
    requireEnvironment();
    return locked(async () => {
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw Error("ID de correo inválido.");
      if (env.GMAIL_INITIAL_MESSAGE_ID && env.GMAIL_INITIAL_MESSAGE_ID !== id) throw Error("El correo seleccionado no coincide con GMAIL_INITIAL_MESSAGE_ID. Actualiza el entorno y reinicia el servidor.");
      const previous = await baseline();
      if (previous) {
        if (id !== previous.initialEmail.id) throw Error("Ya existe un contexto inicial. No se puede reemplazar desde esta sesión.");
        return previous;
      }
      const email = (await api.emails()).find(item => item.id === id);
      if (!email) throw Error("No aparece ese correo. Revisa la etiqueta, el remitente y la fecha.");
      const project = await readJson(local("config/project.json"));
      const issue = await api.issue();
      const context = { project, initialEmail: email, issue, requestEmail: null };
      const analysis = await api.analyze(context);
      await saveJson(local("output/initial-context.json"), { context, analysis });
      const saved = createBaseline({ repo: repository(env), project, email, issue, analysis, sender: env.ALLOWED_SENDER });
      await saveJson(local(".private/baseline.json"), saved);
      event("Acuerdo inicial capturado", `Correo e issue coinciden en ${saved.initialFormat}.`);
      return saved;
    });
  }
  async function run(mode) {
    if (mode !== undefined) throw Error("La interfaz solo admite datos reales.");
    requireEnvironment();
    return locked(async () => {
      const saved = await baseline();
      if (!saved) throw Error("Selecciona el correo inicial y captura el acuerdo desde Conexiones.");
      const state = await processedState();
      const emails = await api.emails();
      if (!emails.some(email => email.id === saved.initialEmail.id)) throw Error("El correo inicial ya no aparece en esta cuenta. Comprueba la etiqueta y la fecha de lectura.");
      const issue = await api.issue();
      for (const [id, entry] of pending) {
        if (issueFingerprint(entry.issue) !== issueFingerprint(issue)) pending.delete(id);
        else if (state.processed[id]?.action === "comment") entry.published = state.processed[id];
      }
      await processEmails({
        baseline: saved, emails: emails.filter(email => !pending.has(email.id)), state,
        publishing: false, sender: env.ALLOWED_SENDER,
        readIssue: () => issue, analyze: api.analyze,
        publish: () => { throw Error("La publicación necesita el botón de revisión."); },
        persist: () => { throw Error("Un análisis no marca correos como publicados."); },
        onPlan: async ({ email, context, analysis, plan }) => {
          const entry = { project: saved.project, initialEmail: saved.initialEmail, requestEmail: email, issue, analysis, plan };
          pending.set(email.id, entry);
          await saveJson(local(`output/${messageKey(email.id)}.json`), { context, analysis, plan });
          if (plan.action === "comment") await writeFile(local(`output/${messageKey(email.id)}-comment.md`), plan.body + "\n", { mode: 0o600 });
          event(plan.action === "comment" ? "Propuesta preparada" : "Correo revisado", plan.action === "comment" ? `${plan.fromFormat} a ${plan.toFormat}. Pendiente de revisión.` : plan.reason);
        },
      });
      const proposals = [...pending.values()].filter(entry => entry.plan.action === "comment" && !state.processed[entry.requestEmail.id]).map(entry => ({ ...entry }));
      const workspace = proposals.at(-1) || [...pending.values()].at(-1) || { project: saved.project, initialEmail: saved.initialEmail, issue, requestEmail: null, analysis: null, plan: null };
      return { workspace, proposals, events: events.slice(0, 30) };
    });
  }
  async function publish(key) {
    requireEnvironment();
    return locked(async () => {
      if (!await baseline()) throw Error("Falta el acuerdo inicial. Captúralo antes de publicar.");
      const entry = [...pending.values()].find(item => item.plan.key === key);
      if (!entry || entry.plan.action !== "comment") throw Error("Vuelve a analizar la solicitud antes de publicar.");
      const state = await processedState();
      if (state.processed[entry.requestEmail.id]) return state.processed[entry.requestEmail.id];
      const comment = await api.publish(entry.plan);
      const result = { action: "comment", id: comment.id, url: comment.html_url };
      state.processed[entry.requestEmail.id] = result;
      await saveJson(local(".private/state.json"), state);
      entry.published = result;
      event("Comentario publicado", `Issue #${entry.issue.number}. El cambio sigue pendiente de decisión humana.`);
      return result;
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
      if (oauth.status === "connected") event("Gmail conectado", "Acceso de lectura autorizado.");
      loginProcess = null;
    });
    return oauth;
  }
  return { config, workspace, inbox, capture, run, publish, login, errorMessage,
    github: async () => { requireEnvironment(); const actor = await api.account(); return { login: actor.login, url: actor.html_url }; },
    close: () => loginProcess?.kill(),
  };
}
