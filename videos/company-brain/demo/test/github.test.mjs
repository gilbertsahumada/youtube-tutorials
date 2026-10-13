import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createBaseline, buildPlan } from "../src/plan.mjs";
import { publishComment, readIssue } from "../src/github.mjs";
const read = async (p) => JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const project = await read("config/project.json"),
  initial = await read("fixtures/initial-email.json"),
  issue = await read("fixtures/issue.json");
const baseline = createBaseline({
  repo: "demo/sandbox",
  project,
  email: initial,
  issue,
  analysis: await read("fixtures/initial-analysis.json"),
  sender: initial.from,
});
const plan = buildPlan({
  baseline,
  email: await read("fixtures/email.json"),
  issue,
  analysis: await read("fixtures/analysis.json"),
  sender: initial.from,
});
const env = { GITHUB_REPO: "demo/sandbox", GITHUB_ISSUE_NUMBER: "1" };
test("única escritura: POST de un comentario; no PR, commits, edición ni cambio de prioridad", () => {
  const calls = [];
  const result = publishComment(plan, env, (path, options) => {
    calls.push({ path, options });
    if (path === "user") return { id: 99 };
    if (path.includes("comments?")) return [];
    if (path.endsWith("/issues/1")) return structuredClone(issue);
    if (options) {
      assert.ok(path.endsWith("/issues/1/comments"));
      return { id: 8, html_url: "https://example.com/comment/8" };
    }
    throw Error(path);
  });
  assert.equal(result.id, 8);
  const writes = calls.filter((c) => c.options);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.method, "POST");
  assert.deepEqual(writes[0].options.body, { body: plan.body });
  assert.ok(!calls.some((c) => /pulls|git\/|contents|labels/.test(c.path)));
});
test("reintenta tras timeout recuperando comentario propio, con paginación", () => {
  let writes = 0;
  const result = publishComment(plan, env, (path, options) => {
    if (options) {
      writes++;
      throw Error("No escribir");
    }
    if (path === "user") return { id: 99 };
    if (path.endsWith("page=1")) return Array.from({ length: 100 }, () => ({ body: "otro" }));
    return [{ id: 8, user: { id: 99 }, body: plan.body }];
  });
  assert.equal(writes, 0);
  assert.equal(result.reused, true);
});
test("un marcador de otro usuario no suplanta al comentario del publicador", () => {
  let writes = 0;
  publishComment(plan, env, (path, options) => {
    if (path === "user") return { id: 99 };
    if (options) {
      writes++;
      return { id: 8 };
    }
    if (path.includes("comments?")) return [{ user: { id: 100 }, body: plan.body }];
    return issue;
  });
  assert.equal(writes, 1);
});
test("destino distinto y issue cambiado bloquean publicación", () => {
  assert.throws(() => publishComment(plan, { ...env, GITHUB_ISSUE_NUMBER: "2" }), /alcance/);
  assert.throws(
    () =>
      publishComment(plan, env, (path) =>
        path === "user"
          ? { id: 99 }
          : path.includes("comments?")
            ? []
            : { ...issue, body: issue.body + "\nCambio humano" },
      ),
    /cambió/,
  );
});
test("no trata un PR como si fuera el issue configurado", () => {
  assert.throws(() => readIssue(env, () => ({ ...issue, pull_request: {} })), /no un PR/);
});
