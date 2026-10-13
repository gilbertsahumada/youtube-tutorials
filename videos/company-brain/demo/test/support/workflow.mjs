import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudio } from "../../src/studio.mjs";
export const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-google-secret", MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "test-model", MODEL_API_KEY: "test-model-secret" };
export const project = { id: "portal", name: "Portal", repository: "org/portal", gmailAfter: "2026-10-12T09:30:15Z", gmailLabel: "" };
export const initial = { id: "initial", threadId: "thread-one", from: "cliente@live.cl", subject: "Exportación del portal", date: "2026-10-12T10:00:00Z", text: "Necesitamos exportar los informes del portal en CSV." };
export const reply = { ...initial, id: "reply", date: "2026-10-12T10:05:00Z", text: "Ahora necesitamos exportar los informes en PDF, en lugar de CSV." };
export function result(context) {
  const fresh = new Set(context.freshEmailIds);
  if (fresh.has("reply") && context.issues.length) {
    const issue = context.issues[0];
    return { summary: "El cliente cambió el formato a PDF.", proposals: [{ action: "update_issue", issueNumber: issue.number, title: issue.title, body: "", changes: [{ before: "Los informes se exportan en CSV.", after: "Los informes se exportan en PDF." }], reason: "El issue conserva CSV y el correo solicita PDF.", sourceEmailIds: ["reply"], evidence: [{ emailId: "reply", quote: "exportar los informes en PDF, en lugar de CSV" }] }] };
  }
  return { summary: "Hay una solicitud sin issue.", proposals: [{ action: "create_issue", issueNumber: null, title: "Exportar informes del portal", body: "Los informes se exportan en CSV.\n\nMantener el resto del portal.", changes: [], reason: "La solicitud todavía no tiene issue.", sourceEmailIds: ["initial"], evidence: [{ emailId: "initial", quote: "exportar los informes del portal en CSV" }] }] };
}
export async function harness(t, { seed = true, clock = () => Date.now() } = {}) {
  const root = await mkdtemp(join(tmpdir(), "brain-workflow-"));
  await mkdir(join(root, ".private"));
  await writeFile(join(root, ".private/gmail-token.json"), JSON.stringify({ refresh_token: "test-refresh-token" }));
  await writeFile(join(root, ".env"), "PRIVATE_TEST=do-not-change\n");
  const live = { mails: [initial], issues: [], writes: [], queries: [], contexts: [], calls: { gmail: 0, model: 0 }, failedWrite: false, modelResult: result };
  const adapters = {
    gmail: async (path, params) => {
      live.calls.gmail++;
      if (path === "labels") return { labels: [{ name: "trabajo", id: "label-work" }] };
      if (path === "messages") { live.queries.push(params); return { messages: live.mails.map(mail => ({ id: mail.id })) }; }
      const mail = live.mails.find(item => item.id === path.split("/")[1]);
      return { id: mail.id, threadId: mail.threadId, internalDate: Date.parse(mail.date), payload: { mimeType: "text/plain", headers: [{ name: "From", value: mail.from }, { name: "Subject", value: mail.subject }], body: { data: Buffer.from(mail.text).toString("base64url") } } };
    },
    model: async (url, options) => {
      live.calls.model++;
      const payload = JSON.parse(options.body), context = JSON.parse(payload.messages[1].content);
      live.contexts.push({ context, payload, url, headers: options.headers });
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(await live.modelResult(context)) } }] }) };
    },
    github: async (path, options = {}) => {
      if (path === "user") return { id: 7, login: "test-user", html_url: "https://github.com/test-user" };
      if (path.startsWith("user/repos")) return [{ full_name: project.repository, private: true }];
      const number = path.match(/\/issues\/(\d+)$/)?.[1];
      if (options.method === "POST" || options.method === "PATCH") {
        const issue = { number: number ? Number(number) : live.issues.length + 1, ...options.body, state: "open", user: { id: 7 }, html_url: "https://github.com/" + project.repository + "/issues/" + (number || live.issues.length + 1) };
        live.issues = live.issues.filter(item => item.number !== issue.number).concat(issue);
        live.writes.push({ path, method: options.method, body: options.body });
        if (live.failedWrite) { live.failedWrite = false; throw Error("La respuesta de GitHub se perdió."); }
        return issue;
      }
      if (number) return live.issues.find(issue => issue.number === Number(number));
      if (path.includes("/issues?")) return live.issues.filter(issue => path.includes("state=all") || issue.state === "open");
      throw Error("Ruta inesperada: " + path);
    },
  };
  const studio = createStudio({ root, env, adapters, scheduler: false, now: clock });
  t.after(async () => { await studio.close(); await rm(root, { recursive: true, force: true }); });
  if (seed) { await studio.saveProject(project); await studio.saveFilter({ projectId: project.id, kind: "domain", value: "live.cl" }); }
  return { root, studio, live, adapters };
}
