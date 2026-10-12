import test from "node:test";
import assert from "node:assert/strict";
import { getEmails, mailbox, plainText } from "../src/gmail.mjs";
test("remitente único y texto plano; HTML y adjuntos no son instrucciones", () => {
  assert.equal(mailbox("Cliente <CLIENT@example.com>"), "client@example.com");
  assert.throws(() => mailbox("a@example.com,b@example.com"), /ambiguo/);
  assert.throws(
    () => mailbox("a@example.com, Cliente <client@example.com>"),
    /ambiguo/,
  );
  const encode = (t) => Buffer.from(t).toString("base64url");
  assert.equal(
    plainText({
      mimeType: "text/plain",
      filename: "secret.txt",
      body: { data: encode("adjunto") },
    }),
    "",
  );
  assert.equal(
    plainText({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/html", body: { data: encode("HTML") } },
        { mimeType: "text/plain", body: { data: encode("texto") } },
        {
          mimeType: "text/plain",
          filename: "secret.txt",
          body: { data: encode("adjunto") },
        },
      ],
    }),
    "texto",
  );
});
test("lista solo correos etiquetados, del remitente y ventana; ordena inicial antes de solicitud", async () => {
  const env = {
    GMAIL_LABEL: "demo",
    ALLOWED_SENDER: "client@example.com",
    GMAIL_AFTER: "2026-01-01T00:00:00Z",
  };
  const results = await getEmails({
    env,
    api: async (path, params) => {
      if (path === "labels") return { labels: [{ id: "label", name: "demo" }] };
      if (path === "messages") {
        assert.equal(params.labelIds, "label");
        assert.match(params.q, /from:"client@example.com"/);
        return { messages: [{ id: "new" }, { id: "bad" }, { id: "initial" }] };
      }
      const id = path.split("/")[1];
      return {
        id,
        internalDate: Date.parse(
          id === "initial" ? "2026-01-10T10:00:00Z" : "2026-01-16T10:00:00Z",
        ),
        payload: {
          mimeType: "text/plain",
          headers: [
            {
              name: "From",
              value: id === "bad" ? "other@example.com" : "client@example.com",
            },
            { name: "Subject", value: id },
          ],
          body: { data: Buffer.from("Prueba").toString("base64url") },
        },
      };
    },
  });
  assert.deepEqual(
    results.map((x) => x.id),
    ["initial", "new"],
  );
});

test("Gmail aplica todos los filtros guardados sin depender de ALLOWED_SENDER", async () => {
  const addresses = { exact: "client@uno.com", domain: "team@dos.com", subdomain: "team@sub.dos.com", spoof: "team@dos.com.evil.com", excluded: "other@uno.com" };
  const emails = await getEmails({ env: { GMAIL_LABEL: "proyectos", GMAIL_AFTER: "2026-01-01T00:00:00Z" },
    filters: [{ kind: "email", value: "client@uno.com" }, { kind: "domain", value: "dos.com" }],
    api: async (path, params) => {
      if (path === "labels") return { labels: [{ id: "label", name: "proyectos" }] };
      if (path === "messages") {
        assert.match(params.q, /\{from:"client@uno.com" from:"@dos.com"\}/);
        return { messages: Object.keys(addresses).map(id => ({ id })) };
      }
      const id = path.split("/")[1];
      return { id, internalDate: Date.parse("2026-01-10T10:00:00Z"), payload: { mimeType: "text/plain", headers: [{ name: "From", value: addresses[id] }, { name: "Subject", value: id }], body: { data: Buffer.from("Texto del correo").toString("base64url") } } };
    },
  });
  assert.deepEqual(emails.map(item => item.id), ["exact", "domain"]);
});

test("Gmail: fecha y participantes del proyecto funcionan sin variables ni etiqueta; pagina y valida los límites", async () => {
  const since = "2026-01-10T10:00:00.500Z";
  const fetched = [];
  const emails = await getEmails({ env: {}, after: since, label: "", filters: [{ kind: "email", value: "client+reports@example.com" }],
    api: async (path, params) => {
      assert.notEqual(path, "labels", "sin etiqueta no se consultan las etiquetas");
      if (path === "messages") {
        assert.equal(params.labelIds, undefined);
        assert.equal(params.q, `after:${Math.floor(Date.parse(since) / 1000) - 1} {from:"client+reports@example.com"}`);
        return params.pageToken ? { messages: [{ id: "boundary" }] } : { messages: [{ id: "new" }, { id: "old" }], nextPageToken: "page-2" };
      }
      const id = path.split("/")[1]; fetched.push(id);
      return { internalDate: Date.parse(since) + (id === "old" ? -1 : id === "boundary" ? 0 : 1000), payload: { mimeType: "text/plain", headers: [{ name: "From", value: "client+reports@example.com" }, { name: "Subject", value: id }], body: { data: Buffer.from("Texto real").toString("base64url") } } };
    },
  });
  assert.deepEqual(fetched, ["new", "old", "boundary"]);
  assert.deepEqual(emails.map(item => item.id), ["boundary", "new"]);
});

test("Gmail: rechaza filtros vacíos, búsqueda inyectada y fecha inválida antes de acceder a la cuenta", async () => {
  const deny = () => { throw Error("No debe consultar Gmail"); };
  await assert.rejects(getEmails({ api: deny, filters: [], after: "2026-01-01" }), /Añade al menos/);
  await assert.rejects(getEmails({ api: deny, filters: [{ kind: "email", value: 'x"} OR in:anywhere {"x@example.com' }], after: "2026-01-01" }), /Correo inválido/);
  await assert.rejects(getEmails({ api: deny, filters: "client@example.com", after: "2026-02-30" }), /fecha válida/);
});

test("Gmail: una etiqueta elegida debe existir; exceso de mensajes no descarga contenidos", async () => {
  const options = { env: {}, filters: "client@example.com", after: "2026-01-01" };
  await assert.rejects(getEmails({ ...options, label: "no-existe", api: async path => { assert.equal(path, "labels"); return { labels: [] }; } }), /etiqueta del proyecto no existe/);
  await assert.rejects(getEmails({ ...options, api: async path => { assert.equal(path, "messages"); return { messages: Array.from({ length: 501 }, (_, id) => ({ id: String(id) })) }; } }), /Más de 500/);
});
