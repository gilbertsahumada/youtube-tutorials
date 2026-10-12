import { readFile, writeFile, mkdir, open, unlink, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { ROOT, readJson, saveJson } from "./common.mjs";
import { createBaseline, buildPlan, classify, messageKey, issueFingerprint } from "./plan.mjs";
import { getEmails } from "./gmail.mjs";
import { gh, repository, readIssue, publishComment } from "./github.mjs";
import { assertBaseline, processEmails } from "./pipeline.mjs";

const fields = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_LABEL", "ALLOWED_SENDER", "GMAIL_AFTER", "GMAIL_INITIAL_MESSAGE_ID", "GITHUB_REPO", "GITHUB_ISSUE_NUMBER", "MODEL_BASE_URL", "MODEL_ID", "MODEL_API_KEY"];
const secrets = new Set(["GOOGLE_CLIENT_SECRET", "MODEL_API_KEY"]);
const sourceFields = new Set(fields.filter(key => !key.startsWith("MODEL_")));
const defaults = { GMAIL_LABEL: "company-brain-demo", GMAIL_AFTER: new Date(Date.now() - 86400000).toISOString() };
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
  const requireFields = keys => {
    const missing = keys.filter(key => !env[key]);
    if (missing.length) throw Error(`Completa la configuración: ${missing.join(", ")}.`);
  };
  async function saveEnvFile(content) {
    const temporary = local(".private/config.env.tmp");
    await mkdir(local(".private"), { recursive: true, mode: 0o700 });
    await writeFile(temporary, content, { mode: 0o600 });
    await rename(temporary, local(".env"));
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
    if (saved.initialEmail.id !== env.GMAIL_INITIAL_MESSAGE_ID) throw Error("El correo inicial cambió. Conserva la configuración de esta demo o utiliza otra copia.");
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
  async function fixture(analyzed = false) {
    const [project, initialEmail, requestEmail, issue, initialAnalysis, analysis] = await Promise.all([
      "config/project.json", "fixtures/initial-email.json", "fixtures/email.json", "fixtures/issue.json", "fixtures/initial-analysis.json", "fixtures/analysis.json",
    ].map(path => readJson(local(path))));
    const result = { mode: "fixture", project, initialEmail, requestEmail, issue, analysis: null, plan: null };
    if (analyzed) {
      const saved = createBaseline({ repo: "demo/sandbox", project, email: initialEmail, issue, analysis: initialAnalysis, sender: initialEmail.from });
      result.plan = buildPlan({ baseline: saved, email: requestEmail, issue, analysis, sender: initialEmail.from });
      result.analysis = analysis;
    }
    return result;
  }
  async function config() {
    const token = await optional(local(".private/gmail-token.json"));
    const saved = await optional(local(".private/baseline.json"));
    const values = Object.fromEntries(fields.filter(key => !secrets.has(key)).map(key => [key, env[key] || defaults[key] || ""]));
    return {
      values, secrets: Object.fromEntries([...secrets].map(key => [key, Boolean(env[key])])),
      gmailConnected: Boolean(token?.refresh_token), baseline: saved,
      oauth: { ...oauth }, events: events.slice(0, 30),
    };
  }
  async function saveConfig(input) {
    return locked(async () => {
      if (loginProcess) throw Error("Espera a que termine la autorización de Gmail antes de cambiar la configuración.");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Configuración inválida.");
      const saved = await optional(local(".private/baseline.json"));
      const next = {};
      for (const [key, value] of Object.entries(input)) {
        if (!fields.includes(key) || typeof value !== "string" || /[\r\n\0]/.test(value) || value.length > 2048 || value.includes("'")) throw Error("Campo de configuración inválido.");
        if (secrets.has(key) && !value) continue;
        if (saved && sourceFields.has(key) && value !== (env[key] || "")) throw Error("Ya hay un contexto capturado para estas cuentas y este issue. Usa otra copia de la demo para cambiar el destino.");
        next[key] = value.trim();
      }
      if (next.GITHUB_REPO) repository({ GITHUB_REPO: next.GITHUB_REPO });
      if (next.GITHUB_ISSUE_NUMBER && (!Number.isSafeInteger(Number(next.GITHUB_ISSUE_NUMBER)) || Number(next.GITHUB_ISSUE_NUMBER) < 1)) throw Error("El número del issue debe ser un entero positivo.");
      if (next.GMAIL_AFTER && !Number.isFinite(Date.parse(next.GMAIL_AFTER))) throw Error("Elige una fecha válida anterior al primer correo.");
      if (next.ALLOWED_SENDER && !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(next.ALLOWED_SENDER)) throw Error("Escribe la dirección del remitente de los correos.");
      if (next.MODEL_BASE_URL) {
        const url = new URL(next.MODEL_BASE_URL);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw Error("La URL del modelo debe ser HTTPS sin credenciales ni parámetros.");
      }
      let content;
      try { content = await readFile(local(".env"), "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; content = "# Configuración guardada desde Company Brain\nPUBLISH=false\nPOLL_SECONDS=30\n"; }
      for (const [key, value] of Object.entries(next)) {
        const line = `${key}='${value}'`;
        const expression = new RegExp(`^${key}=.*$`, "m");
        content = expression.test(content) ? content.replace(expression, () => line) : content.trimEnd() + "\n" + line + "\n";
      }
      await saveEnvFile(content);
      Object.assign(env, next);
      pending.clear();
      event("Configuración guardada", "Las credenciales se guardaron en esta computadora.");
      return config();
    });
  }
  async function inbox() {
    requireFields(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_LABEL", "GMAIL_AFTER", "ALLOWED_SENDER"]);
    return locked(() => api.emails());
  }
  async function capture(id) {
    return locked(async () => {
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw Error("ID de correo inválido.");
      requireFields(fields.filter(key => key !== "GMAIL_INITIAL_MESSAGE_ID"));
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
      // Keep the CLI's baseline and the UI's selected message in the same state.
      let content;
      try { content = await readFile(local(".env"), "utf8"); }
      catch (error) { if (error.code !== "ENOENT") throw error; content = ""; }
      const line = `GMAIL_INITIAL_MESSAGE_ID='${email.id}'`;
      content = /^GMAIL_INITIAL_MESSAGE_ID=.*$/m.test(content) ? content.replace(/^GMAIL_INITIAL_MESSAGE_ID=.*$/m, () => line) : content.trimEnd() + "\n" + line + "\n";
      await saveEnvFile(content);
      env.GMAIL_INITIAL_MESSAGE_ID = email.id;
      await saveJson(local(".private/baseline.json"), saved);
      event("Acuerdo inicial capturado", `Correo e issue coinciden en ${saved.initialFormat}.`);
      return saved;
    });
  }
  async function run(mode) {
    if (mode === "fixture") return { workspace: await fixture(true), proposals: [], events: [] };
    if (mode !== "live") throw Error("Modo inválido.");
    return locked(async () => {
      requireFields(fields);
      const saved = await baseline();
      if (!saved) throw Error("Selecciona el correo inicial y captura el acuerdo desde Configuración.");
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
          const entry = { mode: "live", project: saved.project, initialEmail: saved.initialEmail, requestEmail: email, issue, analysis, plan };
          pending.set(email.id, entry);
          await saveJson(local(`output/${messageKey(email.id)}.json`), { context, analysis, plan });
          if (plan.action === "comment") await writeFile(local(`output/${messageKey(email.id)}-comment.md`), plan.body + "\n", { mode: 0o600 });
          event(plan.action === "comment" ? "Propuesta preparada" : "Correo revisado", plan.action === "comment" ? `${plan.fromFormat} a ${plan.toFormat}. Pendiente de revisión.` : plan.reason);
        },
      });
      const proposals = [...pending.values()].filter(entry => entry.plan.action === "comment" && !state.processed[entry.requestEmail.id]).map(entry => ({ ...entry }));
      const workspace = proposals.at(-1) || [...pending.values()].at(-1) || { mode: "live", project: saved.project, initialEmail: saved.initialEmail, issue, requestEmail: null, analysis: null, plan: null };
      return { workspace, proposals, events: events.slice(0, 30) };
    });
  }
  async function publish(key) {
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
    requireFields(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
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
  return { fixture, config, saveConfig, inbox, capture, run, publish, login,
    github: async () => { const actor = await api.account(); return { login: actor.login, url: actor.html_url }; },
    close: () => loginProcess?.kill(),
  };
}
