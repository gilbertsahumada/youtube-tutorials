import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createOAuthDecoder, parseOAuthEvent } from "../src/oauth/events.mjs";
import { createGmailConnection } from "../src/services/gmail-connection.mjs";
import { createGmailAuthorization } from "../src/oauth/authorization.mjs";
import { env } from "./support/workflow.mjs";

const authorizationURL = "https://accounts.google.com/o/oauth2/v2/auth?state=test";
const protocol = (event) => JSON.stringify(event) + "\n";

test("OAuth: eventos fragmentados y UTF-8 entre bloques conservan mensajes completos", () => {
  const events = [],
    decoder = createOAuthDecoder((event) => events.push(event));
  const input = Buffer.from(
    "\n" +
      protocol({ type: "authorization_url", url: authorizationURL }) +
      protocol({ type: "error", message: "Autorización cancelada" }),
  );
  for (const byte of input) decoder.write(Buffer.from([byte]));
  decoder.end();
  assert.deepEqual(events, [
    { type: "authorization_url", url: authorizationURL },
    { type: "error", message: "Autorización cancelada" },
  ]);
});

test("OAuth: el último evento puede llegar al cerrar stdout sin salto de línea", () => {
  const events = [],
    decoder = createOAuthDecoder((event) => events.push(event));
  decoder.write(protocol({ type: "authorization_url", url: authorizationURL }));
  decoder.write('{"type":"connected"}');
  assert.equal(events.length, 1);
  decoder.end();
  assert.deepEqual(events.at(-1), { type: "connected" });
});

test("OAuth: JSON, tipos, URLs no autorizadas y buffers excesivos se rechazan", () => {
  for (const event of [
    "[",
    "null",
    "[]",
    '{"type":"log"}',
    '{"type":"error","message":7}',
    ...[
      "http://accounts.google.com/auth",
      "https://evil.invalid/",
      "https://accounts.google.com.evil.invalid/",
      "https://user@accounts.google.com/",
      "javascript:alert(1)",
    ].map((url) => JSON.stringify({ type: "authorization_url", url })),
  ])
    assert.throws(() => parseOAuthEvent(event));
  for (const suffix of ["", "\n"])
    assert.throws(() => createOAuthDecoder(() => {}).write("x".repeat(16385) + suffix), /grande/);
  assert.deepEqual(parseOAuthEvent('{"type":"connected","token":"never-forward"}'), {
    type: "connected",
  });
});

function connectionFixture() {
  const children = [],
    calls = [];
  const connection = createGmailConnection({
    root: "/temporary/demo",
    env,
    formatError: (problem) => problem.message.replaceAll(env.GOOGLE_CLIENT_SECRET, "[credencial]"),
    spawnProcess(...args) {
      calls.push(args);
      const child = Object.assign(new EventEmitter(), {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        killed: false,
        kill() {
          this.killed = true;
        },
      });
      children.push(child);
      return child;
    },
  });
  return { connection, children, calls };
}

test("OAuth: el servidor solicita --json, bloquea operaciones simultáneas y espera close", () => {
  const { connection, children, calls } = connectionFixture();
  assert.throws(() => connection.start(true), { status: 423 });
  assert.equal(connection.start().status, "starting");
  assert.equal(calls[0][1].at(-1), "--json");
  assert.throws(() => connection.start(), { status: 423 });
  const child = children[0];
  child.stdout.write(protocol({ type: "authorization_url", url: authorizationURL }));
  assert.deepEqual(connection.snapshot(), { status: "waiting", url: authorizationURL });
  child.emit("exit", 0);
  assert.equal(connection.snapshot().status, "waiting");
  child.stdout.write('{"type":"connected"}');
  child.emit("close", 0);
  assert.deepEqual(connection.snapshot(), { status: "connected" });
  connection.close();
});

test("OAuth: mensajes inválidos detienen el proceso y no se interpretan como logs", () => {
  const { connection, children } = connectionFixture();
  connection.start();
  children[0].stdout.write("Refresh token guardado https://accounts.google.com/auth\n");
  assert.equal(children[0].killed, true);
  assert.match(connection.snapshot().message, /inválida/);
  children[0].stdout.write(protocol({ type: "connected" }));
  children[0].emit("close", 1);
  assert.equal(connection.snapshot().status, "error");
  connection.close();
});

test("OAuth: errores estructurados y cierre incompleto conservan errores sin secretos", () => {
  const { connection, children } = connectionFixture();
  connection.start();
  children[0].stdout.write(
    protocol({ type: "error", message: "Cancelada: " + env.GOOGLE_CLIENT_SECRET }),
  );
  children[0].emit("close", 1);
  assert.deepEqual(connection.snapshot(), { status: "error", message: "Cancelada: [credencial]" });
  connection.start();
  children[1].stderr.write("Caducó: " + env.GOOGLE_CLIENT_SECRET);
  children[1].emit("close", 1);
  assert.deepEqual(connection.snapshot(), { status: "error", message: "Caducó: [credencial]" });
  connection.close();
});

test("OAuth: un proceso anterior o cancelado no modifica una conexión nueva", () => {
  const { connection, children } = connectionFixture();
  connection.start();
  children[0].emit("error", Error("spawn falló"));
  connection.start();
  children[0].stdout.write(protocol({ type: "connected" }));
  children[0].emit("close", 1);
  assert.equal(connection.snapshot().status, "starting");
  children[1].stdout.write(protocol({ type: "authorization_url", url: authorizationURL }));
  connection.close();
  children[1].stdout.write(protocol({ type: "connected" }));
  children[1].emit("close", 0);
  assert.equal(children[1].killed, true);
  assert.equal(connection.snapshot().status, "waiting");
  assert.throws(() => connection.start(), { status: 503 });
});

async function authorizationFixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "brain-oauth-"));
  const tokenPath = join(root, ".private/gmail-token.json");
  const events = [];
  const session = await createGmailAuthorization({
    env,
    tokenPath,
    onEvent: (event) => events.push(event),
    ...options,
  });
  t.after(async () => {
    session.cancel();
    await session.done.catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  const url = new URL(session.url);
  const callback = (params = {}) => {
    const redirect = new URL(url.searchParams.get("redirect_uri"));
    redirect.search = new URLSearchParams({ state: url.searchParams.get("state"), ...params });
    return redirect;
  };
  return { session, events, tokenPath, url, callback };
}

test("OAuth: callback local, PKCE y token privado; los eventos no contienen secretos", async (t) => {
  let exchange;
  const { session, events, tokenPath, url, callback } = await authorizationFixture(t, {
    request: async (endpoint, options) => {
      exchange = { endpoint, options };
      return {
        ok: true,
        json: async () => ({ access_token: "private-access", refresh_token: "private-refresh" }),
      };
    },
  });
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  const response = await fetch(callback({ code: "private-code" }));
  assert.equal(response.status, 200);
  await response.text();
  await session.done;
  assert.equal(exchange.endpoint, "https://oauth2.googleapis.com/token");
  assert.equal(exchange.options.body.get("client_secret"), env.GOOGLE_CLIENT_SECRET);
  assert.equal(
    url.searchParams.get("code_challenge"),
    createHash("sha256").update(exchange.options.body.get("code_verifier")).digest("base64url"),
  );
  assert.deepEqual(JSON.parse(await readFile(tokenPath, "utf8")), {
    refresh_token: "private-refresh",
  });
  assert.equal((await stat(tokenPath)).mode & 0o777, 0o600);
  assert.deepEqual(events.at(-1), { type: "connected" });
  const output = JSON.stringify(events);
  for (const secret of [
    env.GOOGLE_CLIENT_SECRET,
    "private-access",
    "private-refresh",
    "private-code",
    exchange.options.body.get("code_verifier"),
  ])
    assert.equal(output.includes(secret), false);
  await assert.rejects(fetch(callback()), /fetch failed/);
});

test("OAuth: estado incorrecto y rutas ajenas no autorizan ni cierran el callback", async (t) => {
  let exchanges = 0;
  const { session, events, callback } = await authorizationFixture(t, {
    request: async () => {
      exchanges++;
      return { ok: true, json: async () => ({ refresh_token: "test-refresh" }) };
    },
  });
  const wrongPath = callback({ code: "test" });
  wrongPath.pathname = "/unknown";
  assert.equal((await fetch(wrongPath)).status, 404);
  assert.equal((await fetch(callback({ state: "wrong", code: "test" }))).status, 400);
  assert.equal(exchanges, 0);
  assert.equal(events.length, 1);
  const response = await fetch(callback({ code: "test" }));
  await response.text();
  await session.done;
  assert.equal(exchanges, 1);
});

test("OAuth: cancelación del consentimiento emite un error y no guarda autorización", async (t) => {
  const { session, events, tokenPath, callback } = await authorizationFixture(t);
  const response = await fetch(callback({ error: "access_denied" }));
  assert.equal(response.status, 400);
  await response.text();
  await assert.rejects(session.done, /cancelada/);
  await assert.rejects(readFile(tokenPath), { code: "ENOENT" });
  assert.equal(events.at(-1).type, "error");
  assert.equal(events.length, 2);
});

test("OAuth: expiración cierra el servidor y no permite guardar tokens tardíos", async (t) => {
  let signal, entered;
  const called = new Promise((resolve) => {
    entered = resolve;
  });
  const { session, events, tokenPath, callback } = await authorizationFixture(t, {
    timeoutMs: 500,
    request: async (_endpoint, options) => {
      signal = options.signal;
      entered();
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      return { ok: true, json: async () => ({ refresh_token: "late-token" }) };
    },
  });
  const pending = fetch(callback({ code: "test" })).catch(() => null);
  await Promise.race([called, session.done]);
  await assert.rejects(session.done, /expiró/);
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(events.at(-1).type, "error");
  await assert.rejects(readFile(tokenPath), { code: "ENOENT" });
  await assert.rejects(fetch(callback()), /fetch failed/);
});

test("OAuth: cancelar y cerrar varias veces produce un único error", async (t) => {
  const { session, events, tokenPath, callback } = await authorizationFixture(t);
  session.cancel();
  session.cancel();
  await assert.rejects(session.done, /cancelada/);
  assert.equal(events.filter((event) => event.type === "error").length, 1);
  await assert.rejects(readFile(tokenPath), { code: "ENOENT" });
  await assert.rejects(fetch(callback()), /fetch failed/);
});

test("OAuth: errores de API y JSON no imprimen credenciales o respuestas con tokens", async (t) => {
  for (const request of [
    async () => {
      throw Error(env.GOOGLE_CLIENT_SECRET);
    },
    async () => ({ ok: false, status: 401 }),
    async () => ({
      ok: true,
      json: async () => {
        throw Error("private-access-token");
      },
    }),
    async () => ({ ok: true, json: async () => ({ access_token: "private-access-token" }) }),
  ]) {
    const { session, events, tokenPath, callback } = await authorizationFixture(t, { request });
    const response = await fetch(callback({ code: "test" }));
    await response.text();
    await assert.rejects(session.done);
    assert.equal(events.at(-1).type, "error");
    assert.equal(JSON.stringify(events).includes(env.GOOGLE_CLIENT_SECRET), false);
    assert.equal(JSON.stringify(events).includes("private-access-token"), false);
    await assert.rejects(readFile(tokenPath), { code: "ENOENT" });
  }
});
