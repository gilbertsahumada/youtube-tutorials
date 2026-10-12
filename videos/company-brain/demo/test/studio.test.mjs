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

test("UI: ejemplo usa validaciones reales y no consulta ni publica aunque PUBLISH=true", async t => {
  const { studio, calls, root } = await setup(t);
  assert.equal((await studio.fixture()).plan, null);
  const result = await studio.run("fixture");
  assert.equal(result.workspace.plan.toFormat, "PDF");
  assert.match(result.workspace.plan.body, /Pendiente de revisión humana/);
  assert.deepEqual(calls, { emails: 0, analyze: 0, publish: 0 });
  await assert.rejects(access(join(root, ".private/baseline.json")));
  await assert.rejects(studio.publish(result.workspace.plan.key), /antes de publicar/);
});

test("UI real: captura → analiza → revisa → publica una vez; nunca publica al analizar", async t => {
  const { studio, calls, json, initial, originalIssue } = await setup(t);
  const saved = await studio.capture(initial.id);
  assert.equal(saved.initialFormat, "CSV");
  assert.equal((await studio.config()).values.GMAIL_INITIAL_MESSAGE_ID, initial.id);
  assert.equal(calls.publish, 0);
  const result = await studio.run("live");
  assert.equal(result.proposals.length, 1);
  assert.equal(result.workspace.plan.action, "comment");
  assert.equal(calls.analyze, 2);
  assert.equal(calls.publish, 0);
  await studio.run("live");
  assert.equal(calls.analyze, 2, "la observación no reanaliza una solicitud pendiente");
  const comment = await studio.publish(result.workspace.plan.key);
  assert.equal(comment.id, 11);
  assert.equal(calls.publish, 1);
  await studio.publish(result.workspace.plan.key);
  assert.equal(calls.publish, 1);
  assert.equal((await json(".private/state.json")).processed["request-pdf"].id, 11);
  assert.deepEqual((await json(".private/baseline.json")).initialIssue, originalIssue);
  const after = await studio.run("live");
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
  const result = await studio.run("live");
  changeIssue();
  await assert.rejects(studio.publish(result.workspace.plan.key), /issue cambió/);
  await assert.rejects(access(join(root, ".private/state.json")));
  const updated = await studio.run("live");
  assert.equal(updated.workspace.issue.title, "Tarea modificada");
  assert.equal(calls.analyze, 3);
});

test("configuración: conserva secretos, bloquea inyección y no cambia un destino capturado", async t => {
  const { studio, root, initial, env } = await setup(t);
  await writeFile(join(root, ".env"), "# conservar\nGOOGLE_CLIENT_SECRET=google-secret-test\nMODEL_API_KEY=model-secret-test\nPUBLISH=false\n");
  const config = await studio.saveConfig({ MODEL_ID: "updated-model", MODEL_API_KEY: "", GOOGLE_CLIENT_SECRET: "" });
  const content = await readFile(join(root, ".env"), "utf8");
  assert.match(content, /# conservar/);
  assert.match(content, /MODEL_API_KEY=model-secret-test/);
  assert.equal(env.MODEL_ID, "updated-model");
  assert.equal(config.secrets.MODEL_API_KEY, true);
  assert.ok(!JSON.stringify(config).includes("model-secret-test"));
  await assert.rejects(studio.saveConfig({ MODEL_ID: "x\nPUBLISH=true" }), /inválido/);
  await assert.rejects(studio.saveConfig({ PUBLISH: "true" }), /inválido/);
  await assert.rejects(studio.capture("x'\nPUBLISH=true"), /ID de correo inválido/);
  await studio.capture(initial.id);
  await assert.rejects(studio.saveConfig({ GITHUB_REPO: "other/repo" }), /otro destino|cambiar el destino/);
  assert.equal(env.GITHUB_REPO, "demo/sandbox");
});

test("el servidor y la CLI comparten el lock de las operaciones reales", async t => {
  const { studio, root, initial, calls } = await setup(t);
  await studio.capture(initial.id);
  await writeFile(join(root, ".private/watch.lock"), "");
  await assert.rejects(studio.run("live"), /Otra instancia/);
  assert.equal(calls.analyze, 1);
  await access(join(root, ".private/watch.lock"));
});
