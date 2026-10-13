import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudio } from "../src/studio.mjs";
import { issueFingerprint } from "../src/plan.mjs";

async function setup(t, { seedProject = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), "brain-studio-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ["config", "fixtures"]) await cp(new URL("../" + name, import.meta.url), join(root, name), { recursive: true });
  const json = name => readFile(join(root, name), "utf8").then(JSON.parse);
  const [initial, request, originalIssue, initialAnalysis, analysis] = await Promise.all([
    "fixtures/initial-email.json", "fixtures/email.json", "fixtures/issue.json", "fixtures/initial-analysis.json", "fixtures/analysis.json",
  ].map(json));
  let issue = originalIssue;
  let badAnalysis = false;
  const calls = { emails: 0, analyze: 0, publish: 0 };
  const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "google-secret-test", MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "test-model", MODEL_API_KEY: "model-secret-test" };
  const adapters = {
    emails: async () => { calls.emails++; return [initial, request]; },
    issue: () => issue,
    analyze: async context => { calls.analyze++; return badAnalysis ? { ...initialAnalysis, initialEvidence: "CSV" } : context.requestEmail ? analysis : initialAnalysis; },
    publish: plan => {
      calls.publish++;
      if (plan.issueFingerprint !== issueFingerprint(issue)) throw Error("El issue cambió durante el análisis");
      return { id: 11, html_url: "https://github.com/demo/sandbox/issues/1#issuecomment-11" };
    },
    account: () => ({ login: "test", html_url: "https://github.com/test" }),
  };
  const studio = createStudio({ root, env, adapters });
  t.after(() => studio.close());
  if (seedProject) {
    const { allowedFormats, ...project } = await json("config/project.json");
    await studio.saveProject({ ...project, repository: "demo/sandbox", issueNumber: 1, gmailAfter: "2026-01-01", gmailLabel: "demo" });
    await studio.saveFilter({ projectId: project.id, kind: "email", value: initial.from });
  }
  return { root, studio, env, adapters, calls, json, initial, originalIssue, changeIssue: () => { issue = { ...issue, title: "Tarea modificada" }; }, badAnalysis: () => { badAnalysis = true; } };
}

test("UI: sin entorno completo devuelve un error y no lee datos de ejemplo", async t => {
  const { root, env, calls } = await setup(t);
  delete env.MODEL_API_KEY;
  await rm(join(root, "fixtures"), { recursive: true });
  const deny = () => { throw Error("La integración no debe ejecutarse"); };
  const studio = createStudio({ root, env, adapters: { emails: deny, issue: deny, analyze: deny, publish: deny, account: deny } });
  t.after(() => studio.close());
  const config = await studio.config();
  assert.equal(config.ready, false);
  assert.deepEqual(config.missing, ["MODEL_API_KEY"]);
  assert.equal(studio.fixture, undefined);
  assert.equal(studio.saveConfig, undefined);
  await assert.rejects(studio.run(), /Faltan variables de entorno: MODEL_API_KEY/);
  await assert.rejects(studio.workspace(), /Faltan variables/);
  await assert.rejects(studio.run("fixture"), /solo admite datos reales/);
  await assert.rejects(studio.inbox(), /Faltan variables/);
  await assert.rejects(studio.capture("initial-csv"), /Faltan variables/);
  await assert.rejects(studio.publish("key"), /Faltan variables/);
  assert.deepEqual(calls, { emails: 0, analyze: 0, publish: 0 });
  await assert.rejects(access(join(root, ".private/baseline.json")));
});

test("UI real: captura → analiza → revisa → publica una vez; nunca publica al analizar", async t => {
  const { studio, calls, json, initial, originalIssue } = await setup(t);
  const saved = await studio.capture(initial.id);
  assert.equal(saved.initialFormat, "CSV");
  assert.equal((await studio.config()).baseline.initialEmail.id, initial.id);
  assert.equal(calls.publish, 0);
  const result = await studio.run();
  assert.equal(result.proposals.length, 1);
  assert.equal(result.workspace.plan.action, "comment");
  assert.equal(calls.analyze, 2);
  assert.equal(calls.publish, 0);
  await studio.run();
  assert.equal(calls.analyze, 2, "la observación no reanaliza una solicitud pendiente");
  const comment = await studio.publish(result.workspace.plan.key);
  assert.equal(comment.id, 11);
  assert.equal(calls.publish, 1);
  await studio.publish(result.workspace.plan.key);
  assert.equal(calls.publish, 1);
  assert.equal((await studio.workspace()).published.id, 11);
  assert.deepEqual((await studio.config()).baseline.initialIssue, originalIssue);
  const after = await studio.run();
  assert.equal(after.proposals.length, 0);
  assert.equal(after.workspace.published.id, 11);
});

test("rechaza evidencia inválida y guarda el diagnóstico sin capturar ni publicar", async t => {
  const { studio, initial, root, json, badAnalysis, calls } = await setup(t);
  badAnalysis();
  await assert.rejects(studio.capture(initial.id), /al menos 20/);
  await assert.rejects(access(join(root, ".private/baseline.json")));
  assert.equal((await json("output/portal-cliente/initial-context.json")).analysis.initialEvidence, "CSV");
  assert.equal(calls.publish, 0);
});

test("bloquea un comentario si la tarea cambió y permite volver a analizar el contexto", async t => {
  const { studio, initial, calls, changeIssue, root } = await setup(t);
  await studio.capture(initial.id);
  const result = await studio.run();
  changeIssue();
  await assert.rejects(studio.publish(result.workspace.plan.key), /issue cambió/);
  await assert.rejects(access(join(root, ".private/state.json")));
  const updated = await studio.run();
  assert.equal(updated.workspace.issue.title, "Tarea modificada");
  assert.equal(calls.analyze, 3);
});

test("entorno de solo lectura: no expone secretos ni escribe .env al capturar", async t => {
  const { studio, root, initial, env } = await setup(t);
  const originalEnv = { ...env };
  const content = "# configurado manualmente\nMODEL_API_KEY=model-secret-test\n";
  await writeFile(join(root, ".env"), content);
  const config = await studio.config();
  assert.equal(config.ready, true);
  assert.equal(config.values, undefined);
  assert.equal(config.secrets, undefined);
  assert.ok(!JSON.stringify(config).includes("model-secret-test"));
  assert.ok(!JSON.stringify(config).includes("google-secret-test"));
  assert.equal(studio.errorMessage(Error("Bearer leaked model-secret-test google-secret-test")), "[credencial] [credencial] [credencial]");
  await assert.rejects(studio.capture("x'\nPUBLISH=true"), /ID de correo inválido/);
  await studio.capture(initial.id);
  assert.equal(await readFile(join(root, ".env"), "utf8"), content);
  assert.deepEqual(env, originalEnv);
  const workspace = await studio.workspace();
  assert.equal(workspace.initialEmail.id, initial.id);
  assert.equal(workspace.requestEmail, null);
  assert.equal(workspace.plan, null);
});

test("la UI captura el correo seleccionado y guarda su ID y destino en SQLite", async t => {
  const { studio, initial, env } = await setup(t);
  env.GMAIL_INITIAL_MESSAGE_ID = "other-message";
  await studio.capture(initial.id);
  assert.equal((await studio.config()).baseline.initialEmail.id, initial.id);
  env.GITHUB_REPO = "other/repo";
  assert.equal((await studio.config()).repository, "demo/sandbox", "el entorno no sustituye un proyecto guardado");
  const { allowedFormats, captured, ...project } = (await studio.config()).projects[0];
  await assert.rejects(studio.saveProject({ ...project, repository: "other/repo" }), /alcance capturado/);
});

test("el servidor y la CLI comparten el lock de las operaciones reales", async t => {
  const { studio, root, initial, calls } = await setup(t);
  await studio.capture(initial.id);
  await writeFile(join(root, ".private/watch.lock"), "");
  await assert.rejects(studio.run(), /Otra instancia/);
  assert.equal(calls.analyze, 1);
  await access(join(root, ".private/watch.lock"));
});

test("SQLite: recupera propuestas al reiniciar sin volver a analizar ni duplicar la publicación", async t => {
  const { root, env, adapters, studio, initial, calls } = await setup(t);
  await studio.capture(initial.id);
  const result = await studio.run();
  await studio.close();
  const restarted = createStudio({ root, env, adapters });
  t.after(() => restarted.close());
  const restored = await restarted.snapshot();
  assert.equal(restored.proposals.length, 1);
  assert.equal(restored.workspace.plan.key, result.workspace.plan.key);
  assert.equal(restored.events.length, 2);
  await restarted.run();
  assert.equal(calls.analyze, 2);
  await restarted.publish(result.workspace.plan.key);
  await restarted.close();
  const again = createStudio({ root, env, adapters });
  t.after(() => again.close());
  assert.equal((await again.snapshot()).proposals.length, 0);
  assert.equal((await again.workspace()).published.id, 11);
  await again.publish(result.workspace.plan.key);
  assert.equal(calls.publish, 1);
});

test("proyectos vacíos y formularios funcionan sin credenciales ni datos precargados", async t => {
  const root = await mkdtemp(join(tmpdir(), "brain-empty-"));
  const studio = createStudio({ root, env: {} });
  t.after(async () => { await studio.close(); await rm(root, { recursive: true, force: true }); });
  const config = await studio.config();
  assert.deepEqual(config.projects, []);
  assert.deepEqual(config.filters, []);
  assert.equal(config.project, null);
  assert.equal(config.baseline, null);
  const project = { id: "ventas", name: "Ventas", repository: "org/ventas", issueNumber: 8, delivery: "entrega-2", requirement: "informe" };
  await studio.saveProject(project);
  await studio.saveFilter({ projectId: "ventas", kind: "domain", value: "@Empresa.com" });
  const saved = await studio.config();
  assert.equal(saved.environmentReady, false);
  assert.equal(saved.ready, false);
  assert.equal(saved.project.id, "ventas");
  assert.equal(saved.filters[0].value, "empresa.com");
  await assert.rejects(studio.run(), /Faltan variables/);
});

test("el inicio normal ignora la configuración CLI y permite crear el proyecto desde la UI", async t => {
  const { root, env, studio, calls } = await setup(t, { seedProject: false });
  Object.assign(env, { GITHUB_REPO: "demo/sandbox", GITHUB_ISSUE_NUMBER: "1", ALLOWED_SENDER: "client@example.com" });
  await rm(join(root, "config"), { recursive: true });
  const config = await studio.config();
  assert.equal(config.environmentReady, true);
  assert.equal(config.ready, false);
  assert.deepEqual(config.projects, []);
  assert.deepEqual(config.filters, []);
  assert.equal(config.project, null);
  assert.equal(config.baseline, null);
  assert.deepEqual(calls, { emails: 0, analyze: 0, publish: 0 });
  await studio.saveProject({ id: "ventas", name: "Ventas", repository: "org/ventas", issueNumber: 8, delivery: "entrega-2", requirement: "informe" });
  assert.deepEqual(await studio.selectProject("ventas"), { projectId: "ventas" });
  assert.equal((await studio.config()).projects.length, 1);
});

test("dos proyectos: prioridad por correo, asignación explícita y publicación en su destino", async t => {
  const { root, env, adapters, studio, initial, originalIssue, json } = await setup(t);
  await studio.close();
  const second = { id: "informes", name: "Informes", repository: "org/informes", issueNumber: 2, delivery: "entrega-1", requirement: "exportar-reportes" };
  const email = await json("fixtures/email.json");
  const analysis = await json("fixtures/analysis.json");
  const firstAnalysis = await json("fixtures/initial-analysis.json");
  const newInitial = { ...initial, id: "other-initial", from: "director@example.com", text: initial.text.replaceAll("portal-cliente", "informes") };
  const newRequest = { ...email, id: "other-request", from: "director@example.com", text: email.text.replaceAll("portal-cliente", "informes") };
  const secondIssue = { ...originalIssue, number: 2, body: originalIssue.body.replaceAll("portal-cliente", "informes") };
  const destinations = [];
  const live = createStudio({ root, env, adapters: { ...adapters,
    emails: () => [initial, newInitial, newRequest],
    issue: project => project.id === second.id ? secondIssue : originalIssue,
    analyze: context => context.project.id === second.id ? { ...(context.requestEmail ? analysis : firstAnalysis), project: second.id } : firstAnalysis,
    publish: (plan, project) => { destinations.push(project.repository); return { id: 22, html_url: "https://github.com/org/informes/issues/2#issuecomment-22" }; },
  } });
  t.after(() => live.close());
  await live.saveProject(second);
  await live.saveFilter({ projectId: "portal-cliente", kind: "domain", value: "example.com" });
  await live.saveFilter({ projectId: "informes", kind: "domain", value: "example.com" });
  const ambiguous = await live.inbox("informes");
  assert.deepEqual(ambiguous.emails, []);
  assert.equal(ambiguous.ambiguous.length, 2, "el remitente exacto del primer proyecto tiene prioridad global");
  assert.deepEqual((await live.inbox("portal-cliente")).emails.map(item => item.id), [initial.id]);
  await assert.rejects(live.capture(newInitial.id, "informes"), /no está asignado/);
  await assert.rejects(live.assign(initial.id, "informes"), /no coincide/);
  await live.assign(newInitial.id, "informes");
  await live.assign(newRequest.id, "informes");
  await live.capture(newInitial.id, "informes");
  await live.capture(initial.id, "portal-cliente");
  const result = await live.run(undefined, "informes");
  assert.equal(result.workspace.requestEmail.id, newRequest.id);
  assert.equal(result.workspace.plan.issueNumber, 2);
  assert.equal((await live.config("portal-cliente")).baseline.initialEmail.id, initial.id);
  await assert.rejects(live.publish(result.workspace.plan.key, "portal-cliente"), /Vuelve a analizar/);
  await live.selectProject("portal-cliente");
  await live.publish(result.workspace.plan.key, "informes");
  assert.deepEqual(destinations, ["org/informes"], "seleccionar otro proyecto no redirige una propuesta ya revisada");
  await live.close();
  const reopened = createStudio({ root, env, adapters: { ...adapters, emails: () => [newInitial, newRequest] } });
  t.after(() => reopened.close());
  assert.deepEqual((await reopened.inbox("informes")).emails.map(item => item.id), [newInitial.id, newRequest.id]);
});

test("elimina un filtro y bloquea la publicación de una propuesta que ya no pertenece al proyecto", async t => {
  const { studio, initial, calls } = await setup(t);
  await studio.capture(initial.id);
  const result = await studio.run();
  const filter = (await studio.config()).filters[0];
  await studio.saveFilter({ projectId: filter.projectId, kind: "email", value: "other@example.com" });
  await studio.removeFilter(filter.id, filter.projectId);
  await assert.rejects(studio.publish(result.workspace.plan.key), /Vuelve a analizar/);
  assert.equal(calls.publish, 0);
});

test("archivos de scripts anteriores no precargan proyectos ni acuerdos en la UI", async t => {
  const { studio, root, initial, env, adapters } = await setup(t);
  const saved = await studio.capture(initial.id);
  await studio.close();
  await rm(join(root, ".private/company-brain.sqlite"));
  const baselineText = JSON.stringify(saved);
  const stateText = JSON.stringify({ schemaVersion: 2, repo: "demo/sandbox", issueNumber: 1, processed: { "request-pdf": { action: "comment", id: 44, url: "https://github.com/demo/sandbox/issues/1#issuecomment-44" } } });
  await writeFile(join(root, ".private/baseline.json"), baselineText);
  await writeFile(join(root, ".private/state.json"), stateText);
  let classified = 0;
  const fresh = createStudio({ root, env, adapters: { ...adapters, analyze: () => { classified++; throw Error("No analizar sin proyecto"); } } });
  t.after(() => fresh.close());
  const config = await fresh.config();
  assert.deepEqual(config.projects, []);
  assert.deepEqual(config.filters, []);
  assert.equal(config.baseline, null);
  await assert.rejects(fresh.run(), /Crea o selecciona un proyecto/);
  assert.equal(classified, 0);
  assert.equal(await readFile(join(root, ".private/baseline.json"), "utf8"), baselineText);
  assert.equal(await readFile(join(root, ".private/state.json"), "utf8"), stateText);
  await fresh.close();
  const reopened = createStudio({ root, env, adapters });
  t.after(() => reopened.close());
  const restored = await reopened.config();
  assert.deepEqual(restored.projects, []);
  assert.equal(restored.baseline, null);
});
