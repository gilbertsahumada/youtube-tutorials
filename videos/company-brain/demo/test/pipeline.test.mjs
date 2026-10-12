import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createBaseline } from "../src/plan.mjs";
import { processEmails, assertBaseline } from "../src/pipeline.mjs";
const read = async (p) =>
  JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const initial = await read("fixtures/initial-email.json"),
  email = await read("fixtures/email.json"),
  issue = await read("fixtures/issue.json"),
  analysis = await read("fixtures/analysis.json");
const baseline = createBaseline({
  repo: "demo/sandbox",
  project: await read("config/project.json"),
  email: initial,
  issue,
  analysis: await read("fixtures/initial-analysis.json"),
  sender: initial.from,
});
function options(publishing = false) {
  return {
    baseline,
    emails: [initial, email],
    state: { processed: {} },
    publishing,
    sender: initial.from,
    readIssue: async () => structuredClone(issue),
    analyze: async () => structuredClone(analysis),
    publish: async () => ({ id: 8, html_url: "https://example.com/comment/8" }),
    onPlan: async () => {},
    persist: async () => {},
  };
}
test("preview nunca publica ni marca procesado; excluye el correo inicial", async () => {
  const o = options();
  let calls = 0;
  o.publish = async () => {
    throw Error("No publicar");
  };
  o.analyze = async () => {
    calls++;
    return analysis;
  };
  const result = await processEmails(o);
  assert.equal(calls, 1);
  assert.equal(result.length, 1);
  assert.deepEqual(o.state.processed, {});
});
test("publicar marca procesado; otra vuelta no llama al modelo ni duplica", async () => {
  const o = options(true);
  let writes = 0,
    model = 0;
  o.publish = async () => {
    writes++;
    return { id: 8 };
  };
  o.analyze = async () => {
    model++;
    return analysis;
  };
  await processEmails(o);
  await processEmails(o);
  assert.equal(writes, 1);
  assert.equal(model, 1);
  assert.equal(o.state.processed[email.id].id, 8);
});
test("fallo de publicación no marca procesado y se puede recuperar", async () => {
  const o = options(true);
  o.publish = async () => {
    throw Error("timeout");
  };
  await assert.rejects(processEmails(o), /timeout/);
  assert.deepEqual(o.state.processed, {});
  o.publish = async () => ({ id: 8, reused: true });
  await processEmails(o);
  assert.equal(o.state.processed[email.id].id, 8);
});
test("captura inicial impide cambiar de repositorio/issue o reutilizar protocolo antiguo", () => {
  assert.throws(() => assertBaseline(baseline, "other/repo", 1), /otro/);
  assert.throws(() => assertBaseline(baseline, "demo/sandbox", 2), /otro/);
  assert.throws(
    () => assertBaseline({ schemaVersion: 1 }, "demo/sandbox", 1),
    /compatible/,
  );
});
