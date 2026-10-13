import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { get } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDemoServer } from "../src/server.mjs";
import { createStudio } from "../src/studio.mjs";

async function serve(t, env, adapters = {}) {
  const root = await mkdtemp(join(tmpdir(), "brain-http-"));
  await cp(new URL("../config", import.meta.url), join(root, "config"), { recursive: true });
  const server = createDemoServer({ studio: createStudio({ root, env, adapters }) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    await rm(root, { recursive: true, force: true });
  });
  return { root, base: `http://127.0.0.1:${server.address().port}`, port: server.address().port };
}

test("HTTP: entorno incompleto devuelve error sin datos de ejemplo ni acceso a secretos", async t => {
  const deny = () => { throw Error("Ninguna integración debe ejecutarse sin las variables requeridas"); };
  const { root, base, port } = await serve(t,
    { GOOGLE_CLIENT_SECRET: "never-show-google", MODEL_API_KEY: "never-show-model" },
    { emails: deny, issue: deny, analyze: deny, publish: deny, account: deny });
  await writeFile(join(root, ".env"), "NO_EDITAR=original\n");
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Company Brain/);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  for (const path of ["/app.js", "/http.js", "/i18n.js", "/style.css", "/favicon.svg"]) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ["/.env", "/.private/gmail-token.json", "/.private/company-brain.sqlite", "/src/common.mjs", "/fixtures/email.json"]) assert.equal((await fetch(base + path)).status, 404);
  const bootstrapResponse = await fetch(base + "/api/bootstrap");
  assert.equal(bootstrapResponse.status, 503);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.workspace, null);
  assert.equal(bootstrap.config.ready, false);
  assert.ok(bootstrap.config.missing.includes("GOOGLE_CLIENT_ID"));
  assert.match(bootstrap.error, /Faltan variables de entorno/);
  assert.ok(!JSON.stringify(bootstrap).includes("never-show"));
  const headers = { "Content-Type": "application/json", "X-Company-Brain-Token": bootstrap.token };
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers, body: "{}" })).status, 503);
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers, body: '{"mode":"fixture"}' })).status, 400);
  assert.equal((await fetch(base + "/api/config", { method: "POST", headers, body: '{"MODEL_API_KEY":"replaced"}' })).status, 405);
  assert.equal(await readFile(join(root, ".env"), "utf8"), "NO_EDITAR=original\n");
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(base + "/api/config")).status, 403);
  assert.equal((await fetch(base + "/api/bootstrap", { headers: { Origin: "https://other.invalid" } })).status, 403);
  // Node fetch normalizes Host; exercise DNS rebinding protection through HTTP.
  const wrongHost = await new Promise((resolve, reject) => {
    get(base + "/api/bootstrap", { headers: { Host: `other.invalid:${port}` } }, response => { response.resume(); resolve(response.statusCode); }).on("error", reject);
  });
  assert.equal(wrongHost, 403);
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers, body: "{broken" })).status, 400);
});

test("HTTP: con entorno completo carga únicamente los datos de las integraciones", async t => {
  const fixture = async name => JSON.parse(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
  const [initial, email, issue, initialAnalysis, analysis] = await Promise.all(["initial-email", "email", "issue", "initial-analysis", "analysis"].map(fixture));
  const env = {
    GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "private-google",
    MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "test-model", MODEL_API_KEY: "private-model",
  };
  let analyzed = 0;
  let published = 0;
  let issueAccessible = true;
  const { root, base } = await serve(t, env, {
    emails: async () => [initial, email], issue: async () => { if (!issueAccessible) throw Error("GitHub GET issue: Not Found (HTTP 404)"); return issue; },
    analyze: async context => { analyzed++; return context.requestEmail ? analysis : initialAnalysis; },
    publish: async () => { published++; throw Error("Publicar requiere una acción explícita"); },
  });
  await writeFile(join(root, ".env"), "NO_EDITAR=original\n");
  const bootstrapResponse = await fetch(base + "/api/bootstrap");
  assert.equal(bootstrapResponse.status, 503);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.config.environmentReady, true);
  assert.deepEqual(bootstrap.config.projects, []);
  assert.equal(bootstrap.workspace, null);
  assert.equal(analyzed, 0);
  const headers = { "Content-Type": "application/json", "X-Company-Brain-Token": bootstrap.token };
  const { allowedFormats, ...project } = JSON.parse(await readFile(join(root, "config/project.json"), "utf8"));
  const post = (path, body) => fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal((await post("/api/projects", { ...project, repository: "example/company-brain-sandbox", issueNumber: issue.number, gmailAfter: "2025-01-01", gmailLabel: "" })).status, 200);
  assert.equal((await post("/api/filters", { projectId: project.id, kind: "email", value: initial.from })).status, 200);
  assert.equal((await (await fetch(base + "/api/bootstrap")).json()).config.ready, true);
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers, body: '{"mode":"fixture"}' })).status, 400);
  assert.equal(analyzed, 0);
  assert.equal((await fetch(base + "/api/baseline", { method: "POST", headers, body: JSON.stringify({ id: initial.id }) })).status, 200);
  const context = await (await fetch(base + "/api/bootstrap")).json();
  assert.equal(context.workspace.initialEmail.id, initial.id);
  assert.equal(context.workspace.requestEmail, null);
  const response = await fetch(base + "/api/run", { method: "POST", headers, body: "{}" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.workspace.requestEmail.id, email.id);
  assert.equal(result.workspace.plan.toFormat, "PDF");
  assert.equal(analyzed, 2);
  const restored = await (await fetch(base + "/api/bootstrap")).json();
  assert.equal(restored.proposals.length, 1);
  assert.equal(restored.workspace.plan.key, result.workspace.plan.key);
  assert.equal(published, 0);
  assert.ok(!JSON.stringify({ bootstrap, context, result }).includes("private-"));
  assert.equal(await readFile(join(root, ".env"), "utf8"), "NO_EDITAR=original\n");
  issueAccessible = false;
  const inaccessibleResponse = await fetch(base + "/api/bootstrap");
  assert.equal(inaccessibleResponse.status, 400);
  const inaccessible = await inaccessibleResponse.json();
  assert.match(inaccessible.error, /GitHub.*404/);
  assert.equal(inaccessible.config.project.id, project.id);
  assert.equal(inaccessible.config.environmentReady, true);
  assert.equal(inaccessible.workspace, null);
  assert.equal(analyzed, 2, "un error al cargar la tarea no llama al modelo");
});

test("HTTP: variables CLI no crean proyectos; selección y eliminación de filtros devuelven JSON", async t => {
  const { base } = await serve(t, { GITHUB_REPO: "org/anterior", GITHUB_ISSUE_NUMBER: "1", ALLOWED_SENDER: "persona@empresa.com" });
  const bootstrap = await (await fetch(base + "/api/bootstrap")).json();
  assert.deepEqual(bootstrap.config.projects, []);
  const headers = { "Content-Type": "application/json", "X-Company-Brain-Token": bootstrap.token };
  const post = (path, body, authorized = true) => fetch(base + path, { method: "POST", headers: authorized ? headers : { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const project = { id: "ventas", name: "Ventas", repository: "org/ventas", issueNumber: 42, delivery: "entrega-1", requirement: "informe" };
  assert.equal((await post("/api/projects", project, false)).status, 403);
  assert.equal((await post("/api/projects", { ...project, secret: "not-allowed" })).status, 400);
  assert.equal((await post("/api/projects", project)).status, 200);
  const selected = await post("/api/projects/select", { projectId: project.id });
  assert.equal(selected.status, 200);
  assert.match(selected.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await selected.json(), { projectId: project.id });
  const notFound = await post("/api/projects/select", { projectId: "no-existe" });
  assert.equal(notFound.status, 400);
  assert.equal((await notFound.json()).error, "Proyecto no encontrado.");
  const added = await post("/api/filters", { projectId: project.id, kind: "domain", value: "@Empresa.com" });
  assert.equal(added.status, 200);
  const filter = await added.json();
  assert.equal(filter.value, "empresa.com");
  const current = await (await fetch(base + "/api/bootstrap?projectId=ventas")).json();
  assert.equal(current.config.project.id, "ventas");
  assert.equal(current.config.filters.length, 1);
  assert.equal(current.workspace, null);
  assert.equal(current.config.environmentReady, false);
  assert.equal((await post("/api/inbox", { projectId: "ventas" })).status, 503);
  const removed = await post("/api/filters/remove", { id: filter.id, projectId: "ventas" });
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { removed: true });
  const config = await (await fetch(base + "/api/config?projectId=ventas", { headers })).json();
  assert.deepEqual(config.filters, []);
  assert.equal((await fetch(base + "/.private/company-brain.sqlite")).status, 404);
});

test("HTTP → SQLite → Gmail: solo cinco variables, configuración independiente por proyecto y etiqueta opcional", async t => {
  const env = { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret-google", MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "model", MODEL_API_KEY: "secret-model" };
  const queries = [];
  const { root, base } = await serve(t, env, { gmail: async (path, params) => {
    if (path === "labels") return { labels: [{ id: "label-dos", name: "segundo" }] };
    if (path === "messages") { queries.push(params); return { messages: [{ id: "included" }, { id: "excluded" }] }; }
    const id = path.split("/")[1];
    return { internalDate: Date.parse("2026-02-02T00:00:00Z"), payload: { mimeType: "text/plain", headers: [{ name: "From", value: id === "included" ? "persona@example.com" : "persona@example.com.evil.com" }], body: { data: Buffer.from("Mensaje de participante").toString("base64url") } } };
  } });
  await writeFile(join(root, ".env"), "NO_EDITAR=original\n");
  const initial = await (await fetch(base + "/api/bootstrap")).json();
  assert.equal(initial.config.environmentReady, true);
  assert.deepEqual(initial.config.missing, []);
  assert.deepEqual(initial.config.projects, []);
  const headers = { "Content-Type": "application/json", "X-Company-Brain-Token": initial.token };
  const post = async (path, body) => {
    const response = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
    const value = await response.json();
    assert.equal(response.status, 200, JSON.stringify(value));
    return value;
  };
  const project = { id: "uno", name: "Uno", repository: "org/uno", issueNumber: 1, delivery: "entrega-1", requirement: "informe", gmailAfter: "2026-01-01", gmailLabel: "" };
  await post("/api/projects", project);
  await post("/api/projects", { ...project, id: "dos", name: "Dos", repository: "org/dos", gmailAfter: "2026-02-01", gmailLabel: "segundo" });
  await post("/api/filters", { projectId: "uno", kind: "domain", value: "example.com" });
  await post("/api/filters", { projectId: "dos", kind: "domain", value: "example.com" });
  const inbox = await post("/api/inbox", { projectId: "uno" });
  assert.deepEqual(inbox.ambiguous.map(item => item.id), ["included"], "el dominio completo excluye dominios suplantados");
  assert.equal(queries[0].labelIds, undefined);
  assert.equal(queries[0].q, `after:${Date.parse("2026-01-01") / 1000 - 1} {from:"@example.com"}`);
  await post("/api/inbox", { projectId: "dos" });
  assert.equal(queries[1].labelIds, "label-dos");
  assert.match(queries[1].q, new RegExp(`after:${Date.parse("2026-02-01") / 1000 - 1} `));
  await post("/api/projects", { ...project, gmailAfter: "2026-01-15" });
  const config = (await (await fetch(base + "/api/bootstrap?projectId=uno")).json()).config;
  assert.equal(config.ready, true);
  assert.equal(config.projects[0].gmailAfter, "2026-01-15T00:00:00.000Z");
  assert.equal(config.projects[0].gmailLabel, "");
  assert.equal(config.projects[1].gmailLabel, "segundo");
  assert.equal(await readFile(join(root, ".env"), "utf8"), "NO_EDITAR=original\n");
  assert.ok(!JSON.stringify(config).includes("secret-"));
});
