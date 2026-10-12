import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStudio } from "../src/studio.mjs";
import { issueFingerprint } from "../src/plan.mjs";

async function setup(t) {
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
  const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "google-secret-test", GMAIL_LABEL: "demo", ALLOWED_SENDER: "client@example.com", GMAIL_AFTER: "2026-01-01T00:00:00Z", GITHUB_REPO: "demo/sandbox", GITHUB_ISSUE_NUMBER: "1", MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "test-model", MODEL_API_KEY: "model-secret-test", PUBLISH: "true" };
  const studio = createStudio({ root, env, adapters: {
    emails: async () => { calls.emails++; return [initial, request]; },
    issue: () => issue,
    analyze: async context => { calls.analyze++; return badAnalysis ? { ...initialAnalysis, initialEvidence: "CSV" } : context.requestEmail ? analysis : initialAnalysis; },
    publish: plan => {
      calls.publish++;
      if (plan.issueFingerprint !== issueFingerprint(issue)) throw Error("El issue cambió durante el análisis");
      return { id: 11, html_url: "https://github.com/demo/sandbox/issues/1#issuecomment-11" };
    },
    account: () => ({ login: "test", html_url: "https://github.com/test" }),
  } });
  return { root, studio, env, calls, json, initial, originalIssue, changeIssue: () => { issue = { ...issue, title: "Tarea modificada" }; }, badAnalysis: () => { badAnalysis = true; } };
}

test("UI: sin entorno completo devuelve un error y no lee datos de ejemplo", async t => {
  const { root, env, calls } = await setup(t);
  delete env.MODEL_API_KEY;
  await rm(join(root, "fixtures"), { recursive: true });
  const deny = () => { throw Error("La integración no debe ejecutarse"); };
  const studio = createStudio({ root, env, adapters: { emails: deny, issue: deny, analyze: deny, publish: deny, account: deny } });
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
  assert.equal((await json(".private/state.json")).processed["request-pdf"].id, 11);
  assert.deepEqual((await json(".private/baseline.json")).initialIssue, originalIssue);
  const after = await studio.run();
  assert.equal(after.proposals.length, 0);
  assert.equal(after.workspace.published.id, 11);
});

test("rechaza evidencia inválida y guarda el diagnóstico sin capturar ni publicar", async t => {
  const { studio, initial, root, json, badAnalysis, calls } = await setup(t);
  badAnalysis();
  await assert.rejects(studio.capture(initial.id), /al menos 20/);
  await assert.rejects(access(join(root, ".private/baseline.json")));
  assert.equal((await json("output/initial-context.json")).analysis.initialEvidence, "CSV");
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

test("una captura guarda el destino y respeta el ID inicial declarado en el entorno", async t => {
  const { studio, initial, env } = await setup(t);
  env.GMAIL_INITIAL_MESSAGE_ID = "other-message";
  await assert.rejects(studio.capture(initial.id), /no coincide con GMAIL_INITIAL_MESSAGE_ID/);
  env.GMAIL_INITIAL_MESSAGE_ID = initial.id;
  await studio.capture(initial.id);
  env.GITHUB_REPO = "other/repo";
  await assert.rejects(studio.workspace(), /otro repositorio o issue/);
});

test("el servidor y la CLI comparten el lock de las operaciones reales", async t => {
  const { studio, root, initial, calls } = await setup(t);
  await studio.capture(initial.id);
  await writeFile(join(root, ".private/watch.lock"), "");
  await assert.rejects(studio.run(), /Otra instancia/);
  assert.equal(calls.analyze, 1);
  await access(join(root, ".private/watch.lock"));
});
