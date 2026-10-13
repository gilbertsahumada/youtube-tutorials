import test from "node:test";
import assert from "node:assert/strict";
import { createDemoServer } from "../src/server.mjs";
import { createStudio } from "../src/studio.mjs";
import { harness, project, reply } from "./support/workflow.mjs";
async function serve(t, studio) {
  const server = createDemoServer({ studio });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await studio.close(); });
  const base = "http://127.0.0.1:" + server.address().port;
  const bootstrap = await (await fetch(base + "/api/bootstrap")).json();
  const headers = { "Content-Type": "application/json", "X-Company-Brain-Token": bootstrap.token };
  const post = async (path, body, status = 200) => {
    const response = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
    const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value;
  };
  return { server, base, headers, bootstrap, post };
}
test("HTTP: crear proyecto, sincronizar, analizar, revisar, aprobar y actualizar con rutas estables", async t => {
  const { studio, live } = await harness(t, { seed: false });
  const { base, headers, post } = await serve(t, studio);
  const created = await post("/api/projects", project);
  await post("/api/filters", { projectId: created.id, kind: "domain", value: "live.cl" });
  await post("/api/mail/sync", { projectId: created.id }); await post("/api/agent/analyze", { projectId: created.id });
  let snapshot = await (await fetch(base + "/api/bootstrap?projectId=" + created.id)).json();
  const item = snapshot.proposals[0]; assert.equal(item.status, "pending"); assert.equal(snapshot.mails.length, 1); assert.deepEqual(live.writes, []);
  const detail = await (await fetch(base + "/api/proposals/detail?projectId=" + created.id + "&id=" + item.id, { headers })).json();
  await post("/api/proposals/approve", { projectId: created.id, proposalId: item.id });
  assert.equal(live.writes[0].body.body, detail.previewBody);
  live.mails.push(reply); await post("/api/mail/sync", { projectId: created.id }); await post("/api/agent/analyze", { projectId: created.id });
  snapshot = await (await fetch(base + "/api/bootstrap?projectId=" + created.id)).json();
  const update = snapshot.proposals.find(item => item.status === "pending");
  await post("/api/proposals/approve", { projectId: created.id, proposalId: update.id });
  assert.equal(live.writes.at(-1).method, "PATCH");
  const repositories = await (await fetch(base + "/api/repositories", { headers })).json();
  assert.equal(repositories.repositories[0].name, project.repository);
  for (const name of ["/router.js", "/workflow-i18n.js"]) assert.equal((await fetch(base + name)).status, 200);
  const invalid = await fetch(base + "/api/bootstrap?projectId=missing"); assert.equal(invalid.status, 404); assert.match((await invalid.json()).error, /no encontrado/);
});
test("HTTP local: bloqueo de otros orígenes, token, secretos, JSON vacío y rutas retiradas", async t => {
  const { studio } = await harness(t);
  const { base, headers, post } = await serve(t, studio);
  for (const path of ["/.env", "/.private/gmail-token.json", "/.private/company-brain.sqlite", "/src/store.mjs"]) assert.equal((await fetch(base + path)).status, 404);
  assert.equal((await fetch(base + "/api/config", { headers: { Origin: "https://evil.invalid" } })).status, 403);
  assert.equal((await fetch(base + "/api/config", { headers: { Host: "evil.invalid" } })).status, 403);
  assert.equal((await fetch(base + "/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(base + "/api/projects", { method: "POST", headers, body: "[" })).status, 400);
  const secret = await post("/api/projects", { ...project, MODEL_API_KEY: "forbidden" }, 400); assert.match(secret.error, /Campo/);
  await post("/api/config", { secret: "forbidden" }, 405);
  for (const path of ["/api/inbox", "/api/baseline", "/api/run", "/api/publish"]) await post(path, {}, 404);
  await post("/api/data/reset", {}, 400);
  assert.equal((await studio.config()).projects.length, 1);
});
test("bootstrap sin env explica qué falta y permite proyectos sin precargar datos", async t => {
  const { root } = await harness(t, { seed: false });
  const studio = createStudio({ root, env: {}, scheduler: false });
  const { base, post } = await serve(t, studio);
  const response = await fetch(base + "/api/bootstrap"), body = await response.json();
  assert.equal(response.status, 503); assert.equal(body.config.environmentReady, false); assert.match(body.error, /MODEL_API_KEY/);
  assert.deepEqual(body.mails, []); assert.deepEqual(body.config.projects, []);
  await post("/api/projects", project); await post("/api/filters", { projectId: project.id, kind: "email", value: "x@live.cl" });
  await post("/api/mail/sync", { projectId: project.id }, 503);
  await post("/api/data/reset", { confirmation: "RESET_LOCAL_DATA" });
  assert.deepEqual((await studio.config()).projects, []);
});
