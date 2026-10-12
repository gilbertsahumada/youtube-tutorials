import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createBaseline,
  buildPlan,
  buildMessages,
  classify,
  messageKey,
  safeText,
} from "../src/plan.mjs";
const read = async (path) =>
  JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
const project = await read("config/project.json"),
  initialEmail = await read("fixtures/initial-email.json"),
  email = await read("fixtures/email.json"),
  issue = await read("fixtures/issue.json"),
  initialAnalysis = await read("fixtures/initial-analysis.json"),
  analysis = await read("fixtures/analysis.json");
const baseline = createBaseline({
  repo: "demo/sandbox",
  project,
  email: initialEmail,
  issue,
  analysis: initialAnalysis,
  sender: "client@example.com",
});
const input = () =>
  structuredClone({
    baseline,
    email,
    issue,
    analysis,
    sender: "client@example.com",
  });

test("captura el correo inicial real como contexto sin proponer ni cambiar el issue", () => {
  assert.equal(baseline.initialFormat, "CSV");
  assert.deepEqual(baseline.initialEmail, initialEmail);
  assert.deepEqual(baseline.initialIssue, issue);
  assert.throws(
    () =>
      createBaseline({
        repo: "x/y",
        project,
        email: initialEmail,
        issue,
        analysis: { ...initialAnalysis, initialFormat: "PDF" },
        sender: initialEmail.from,
      }),
    /no coinciden/,
  );
});
test("una solicitud de priorizar PDF basta; no se exige aprobación previa", () => {
  const data = input(),
    before = structuredClone(data),
    plan = buildPlan(data);
  assert.equal(plan.action, "comment");
  assert.equal(plan.toFormat, "PDF");
  assert.equal(plan.fromFormat, "CSV");
  assert.ok(!("files" in plan) && !("branch" in plan));
  assert.match(plan.body, /Pendiente de revisión humana/);
  assert.match(plan.body, /No se creó un PR/);
  assert.ok(
    plan.body.includes(analysis.initialEvidence) &&
      plan.body.includes(analysis.requestEvidence),
  );
  assert.deepEqual(data, before);
});
test("también permite PDF → CSV cuando el contexto y la tarea coinciden", () => {
  const data = input();
  data.baseline.initialFormat = "PDF";
  data.baseline.initialEmail.text = initialEmail.text.replaceAll("CSV", "PDF");
  data.analysis.initialFormat = "PDF";
  data.analysis.initialEvidence = initialAnalysis.initialEvidence.replaceAll(
    "CSV",
    "PDF",
  );
  data.issue.body = data.issue.body.replaceAll("CSV", "PDF");
  data.issue.title = "Exportar PDF";
  data.email.text = email.text
    .replaceAll("PDF", "TEMP")
    .replaceAll("CSV", "PDF")
    .replaceAll("TEMP", "CSV");
  data.analysis.requestedFormat = "CSV";
  data.analysis.requestEvidence = analysis.requestEvidence
    .replaceAll("PDF", "TEMP")
    .replaceAll("CSV", "PDF")
    .replaceAll("TEMP", "CSV");
  assert.equal(buildPlan(data).toFormat, "CSV");
});
test("ambigüedad y formato ya pedido no publican propuestas", () => {
  let data = input();
  data.analysis.changeRequested = false;
  assert.equal(buildPlan(data).action, "skip");
  data = input();
  data.issue.body = data.issue.body.replaceAll("CSV", "PDF");
  assert.equal(buildPlan(data).action, "skip");
});
for (const [name, mutate] of [
  ["otro remitente", (d) => (d.email.from = "other@example.com")],
  ["otro proyecto", (d) => (d.analysis.project = "otro")],
  ["otra entrega", (d) => (d.analysis.delivery = "entrega-2")],
  [
    "texto de otro proyecto",
    (d) => (d.email.text = d.email.text.replace("portal-cliente", "otro")),
  ],
  [
    "evidencia inventada",
    (d) =>
      (d.analysis.requestEvidence =
        "Una petición de PDF inexistente en el correo"),
  ],
  [
    "contexto inicial inventado",
    (d) =>
      (d.analysis.initialEvidence =
        "Un acuerdo CSV inexistente en el correo original"),
  ],
  [
    "formato/ruta arbitraria",
    (d) => (d.analysis.requestedFormat = "../../workflow"),
  ],
  ["issue cerrado", (d) => (d.issue.state = "closed")],
  [
    "issue ajeno",
    (d) =>
      (d.issue.body = d.issue.body.replace(
        "Proyecto: portal-cliente",
        "Proyecto: otro",
      )),
  ],
  ["formato inicial contradictorio", (d) => (d.analysis.initialFormat = "PDF")],
  ["booleano inválido", (d) => (d.analysis.changeRequested = "true")],
  [
    "sin formato actual",
    (d) =>
      (d.issue.body = d.issue.body.replace(
        "Formato actual: CSV",
        "Formato: CSV",
      )),
  ],
])
  test(`rechaza ${name}`, () => {
    const data = input();
    mutate(data);
    assert.throws(() => buildPlan(data));
  });
test("correos anteriores e inicial no se reproponen", () => {
  const data = input();
  data.email.date = initialEmail.date;
  assert.equal(buildPlan(data).action, "skip");
  data.email.id = initialEmail.id;
  assert.equal(buildPlan(data).action, "skip");
});
test("evidencia no puede inyectar HTML, menciones ni títulos markdown", () => {
  assert.equal(
    safeText("@all <script> **hello**"),
    "&#64;all &lt;script&gt; \\*\\*hello\\*\\*",
  );
  assert.match(messageKey("../evil"), /^[a-f0-9]{20}$/);
});
test("el prompt distingue solicitud de aprobación y no tiene herramientas", () => {
  const messages = buildMessages({
    initialEmail,
    requestEmail: email,
    issue,
    project,
  });
  assert.match(
    messages[0].content,
    /no hace falta que sea un acuerdo aprobado/,
  );
  assert.match(messages[0].content, /No tienes tools/);
});
test("adaptador real envía los dos correos sin secretos en el body; errores no usan fixture", async () => {
  const env = {
    MODEL_BASE_URL: "https://example.com/v1",
    MODEL_ID: "test",
    MODEL_API_KEY: "secret",
  };
  const result = await classify(
    { initialEmail, requestEmail: email, issue, project },
    env,
    async (url, options) => {
      assert.equal(url, "https://example.com/v1/chat/completions");
      const body = JSON.parse(options.body);
      assert.ok(!("tools" in body));
      assert.ok(!options.body.includes("secret"));
      assert.equal(
        JSON.parse(body.messages[1].content).initialEmail.id,
        initialEmail.id,
      );
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(analysis) } }],
        }),
      };
    },
  );
  assert.equal(result.requestedFormat, "PDF");
  await assert.rejects(
    classify({}, env, async () => ({ ok: false, status: 401 })),
    /401/,
  );
  await assert.rejects(
    classify({}, { ...env, MODEL_BASE_URL: "http://localhost" }),
    /HTTPS/,
  );
});
