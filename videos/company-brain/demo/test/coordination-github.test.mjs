import test from "node:test";
import assert from "node:assert/strict";
import { listIssues, applyProposal, getIssue } from "../src/coordination-github.mjs";
import { issueDigest, issueVersion } from "../src/agent.mjs";
import { randomUUID } from "node:crypto";
const issue = { number: 1, title: "Informe", body: "Formato CSV.", state: "open", userId: 7 };
const proposal = () => ({
  id: randomUUID(),
  action: "create_issue",
  repository: "org/repo",
  title: "Informe",
  body: "Formato CSV.",
  evidence: [{ emailId: "mail", quote: "Necesitamos CSV." }],
  sources: [{ id: "mail", from: "client@live.cl", date: "2026-10-12T10:00:00Z" }],
  issueDigest: issueDigest([]),
  issueSnapshot: null,
});
test("lista issues paginados y descarta PRs", async () => {
  const pages = [];
  const first = [
    ...Array.from({ length: 99 }, (_, index) => ({ ...issue, number: index + 1 })),
    { ...issue, number: 100, pull_request: {} },
  ];
  const issues = await listIssues("org/repo", async (path) => {
    pages.push(path);
    return path.endsWith("page=1") ? first : [{ ...issue, number: 101 }];
  });
  assert.equal(issues.length, 100);
  assert.equal(issues.at(-1).number, 101);
  assert.equal(pages.length, 2);
});
test("no sobreescribe un issue modificado ni acepta un PR como destino", async () => {
  const item = { ...proposal(), action: "update_issue", issueNumber: 1, issueSnapshot: issue };
  const calls = [];
  await assert.rejects(
    applyProposal(item, async (path) => {
      calls.push(path);
      return { ...issue, title: "Modificado por otra persona" };
    }),
    (error) => error.stale === true && error.status === 409,
  );
  assert.equal(calls.length, 1);
  await assert.rejects(
    getIssue("org/repo", 1, async () => ({ ...issue, pull_request: {} })),
    /issue válido/,
  );
});
test("un marcador ajeno no evita crear; la recuperación comprueba el autor", async () => {
  const item = proposal(),
    foreign = { ...issue, body: "<!-- company-brain-proposal:" + item.id + " -->", userId: 99 };
  item.issueDigest = issueDigest([foreign]);
  let writes = 0;
  const created = await applyProposal(item, async (path, options = {}) => {
    if (path === "user") return { id: 7 };
    if (options.method === "POST") {
      writes++;
      return { ...issue, number: 2, ...options.body };
    }
    return [foreign];
  });
  assert.equal(created.number, 2);
  assert.equal(writes, 1);
  assert.notEqual(issueVersion(issue), issueVersion({ ...issue, state: "closed" }));
});
