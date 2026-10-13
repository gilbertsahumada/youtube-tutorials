import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMailbox, buildAgentMessages, validateAnalysis, batches } from "../src/agent.mjs";
import { env, project, initial, result } from "./support/workflow.mjs";
const mail = { ...initial, hash: "mail-hash", analyzed: false };
const context = {
  project,
  emails: [mail],
  freshEmailIds: [mail.id],
  issues: [],
  links: [],
  decisions: [],
  pendingProposals: [],
};
const validate = (data) =>
  validateAnalysis(data, { project, emails: [mail], fresh: [mail], issues: [] });
test("agente prepara acciones con evidencia, sin secretos, herramientas ni instrucciones de fuentes", async () => {
  const messages = buildAgentMessages(context);
  assert.match(messages[0].content, /no confiables/);
  assert.match(messages[0].content, /pendingProposals/);
  const output = await analyzeMailbox(context, env, async (url, options) => {
    assert.equal(url, "https://model.invalid/v1/chat/completions");
    const payload = JSON.parse(options.body);
    assert.equal(payload.tools, undefined);
    assert.equal(payload.model, "test-model");
    assert.ok(!options.body.includes(env.MODEL_API_KEY));
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(result(context)) } }] }),
    };
  });
  const proposal = validate(output).proposals[0];
  assert.equal(proposal.sources[0].hash, mail.hash);
  assert.equal(proposal.issueNumber, null);
});
test("no acepta evidencia, correos, acciones o issues inventados", () => {
  const good = result(context);
  for (const change of [
    (item) => {
      item.evidence[0].quote = "frase inventada";
    },
    (item) => {
      item.sourceEmailIds = ["other"];
    },
    (item) => {
      item.action = "send_email";
    },
    (item) => {
      item.action = "update_issue";
      item.issueNumber = 99;
    },
    (item) => {
      item.repository = "org/evil";
    },
  ]) {
    const data = structuredClone(good);
    change(data.proposals[0]);
    assert.throws(() => validate(data));
  }
  assert.throws(
    () => validateAnalysis(good, { project, emails: [mail], fresh: [], issues: [] }),
    /correos nuevos/,
  );
});
test("actualiza extractos únicos y conserva texto ajeno; rechaza reemplazos ambiguos", () => {
  const issue = {
    number: 1,
    title: "Informe",
    body: "Formato acordado: CSV.\nOtra función permanece.",
    state: "open",
  };
  const data = result(context);
  Object.assign(data.proposals[0], {
    action: "update_issue",
    issueNumber: 1,
    title: issue.title,
    body: "",
    changes: [{ before: "Formato acordado: CSV.", after: "Formato acordado: PDF." }],
  });
  const params = { project, emails: [mail], fresh: [mail], issues: [issue] };
  assert.equal(
    validateAnalysis(data, params).proposals[0].body,
    "Formato acordado: PDF.\nOtra función permanece.",
  );
  issue.body += "\nFormato acordado: CSV.";
  assert.throws(() => validateAnalysis(data, params), /extracto único/);
});
test("todos los correos nuevos pasan por lotes y los hilos incluyen contexto previo", () => {
  const old = {
    ...mail,
    id: "old",
    analyzed: true,
    text: "Contexto anterior",
    date: "2026-10-12T09:50:00Z",
  };
  const emails = [
    old,
    ...Array.from({ length: 8 }, (_, index) => ({
      ...mail,
      id: "new-" + index,
      text: "x".repeat(20000),
    })),
    { ...mail, id: "other-thread", threadId: "other" },
  ];
  const chunks = batches(emails);
  assert.deepEqual(
    chunks.flatMap((batch) => batch.fresh.map((mail) => mail.id)).sort(),
    emails
      .filter((mail) => !mail.analyzed)
      .map((mail) => mail.id)
      .sort(),
  );
  assert.ok(chunks[0].emails.some((mail) => mail.id === "old"));
  assert.ok(
    chunks.every((batch) => batch.emails.reduce((sum, mail) => sum + mail.text.length, 0) <= 60000),
  );
});
test("errores del proveedor, JSON inválido y contexto excesivo no generan resultados de ejemplo", async () => {
  await assert.rejects(
    analyzeMailbox(context, env, async () => ({ ok: false, status: 401 })),
    /HTTP 401/,
  );
  await assert.rejects(
    analyzeMailbox(context, env, async () => ({ ok: true, json: async () => ({ choices: [] }) })),
    /JSON solicitado/,
  );
  await assert.rejects(
    analyzeMailbox({ ...context, extra: "x".repeat(240001) }, env, () => {
      throw Error("No debe enviarse");
    }),
    /demasiado grande/,
  );
});
