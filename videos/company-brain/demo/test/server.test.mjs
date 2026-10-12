import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { get } from "node:http";
import { createDemoServer } from "../src/server.mjs";
import { createStudio } from "../src/studio.mjs";

// Test the actual HTTP boundary using fixtures; every external adapter fails closed.
test("HTTP: interfaz → API → fixture → propuesta; sesión local, secretos y archivos protegidos", async t => {
  const deny = () => { throw Error("Ninguna integración real debe ejecutarse en este test"); };
  const server = createDemoServer({ studio: createStudio({ env: { GOOGLE_CLIENT_SECRET: "never-show-google", MODEL_API_KEY: "never-show-model", PUBLISH: "true" }, adapters: { emails: deny, issue: deny, analyze: deny, publish: deny, account: deny } }) });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Company Brain/);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  for (const path of ["/app.js", "/i18n.js", "/style.css", "/favicon.svg"]) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ["/.env", "/.private/gmail-token.json", "/src/common.mjs"]) assert.equal((await fetch(base + path)).status, 404);
  const bootstrap = await (await fetch(base + "/api/bootstrap")).json();
  assert.equal(bootstrap.workspace.plan, null);
  assert.equal(bootstrap.config.secrets.MODEL_API_KEY, true);
  assert.ok(!JSON.stringify(bootstrap).includes("never-show"));
  const headers = { "Content-Type": "application/json", "X-Company-Brain-Token": bootstrap.token };
  const run = await fetch(base + "/api/run", { method: "POST", headers, body: JSON.stringify({ mode: "fixture" }) });
  const result = await run.json();
  assert.equal(run.status, 200);
  assert.equal(result.workspace.plan.toFormat, "PDF");
  assert.match(result.workspace.plan.body, /Pendiente de revisión humana/);
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"mode":"fixture"}' })).status, 403);
  assert.equal((await fetch(base + "/api/config")).status, 403);
  assert.equal((await fetch(base + "/api/bootstrap", { headers: { Origin: "https://other.invalid" } })).status, 403);
  // Node fetch normalizes Host; send the header through HTTP to exercise DNS rebinding protection.
  const wrongHost = await new Promise((resolve, reject) => {
    get(base + "/api/bootstrap", { headers: { Host: `other.invalid:${server.address().port}` } }, response => { response.resume(); resolve(response.statusCode); }).on("error", reject);
  });
  assert.equal(wrongHost, 403);
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers, body: "{broken" })).status, 400);
  assert.equal((await fetch(base + "/api/run", { method: "POST", headers, body: '{"mode":"invalid"}' })).status, 400);
});
