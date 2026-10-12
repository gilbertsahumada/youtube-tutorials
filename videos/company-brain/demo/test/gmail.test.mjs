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
