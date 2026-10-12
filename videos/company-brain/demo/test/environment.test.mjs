import test from "node:test";
import assert from "node:assert/strict";
import { environmentStatus, requiredFields } from "../src/environment.mjs";

const complete = {
  GOOGLE_CLIENT_ID: "private-client", GOOGLE_CLIENT_SECRET: "private-google", GMAIL_LABEL: "inbox-label",
  ALLOWED_SENDER: "client@example.com", GMAIL_AFTER: "2025-01-01T00:00:00Z",
  GITHUB_REPO: "example/repository", GITHUB_ISSUE_NUMBER: "42",
  MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "model", MODEL_API_KEY: "private-model",
};

test("entorno: informa todas las variables faltantes sin exponer valores", () => {
  assert.deepEqual(environmentStatus({}).missing, requiredFields);
  for (const field of requiredFields) {
    const status = environmentStatus({ ...complete, [field]: "  " });
    assert.equal(status.ready, false);
    assert.deepEqual(status.missing, [field]);
  }
  const status = environmentStatus(complete);
  assert.equal(status.ready, true);
  assert.deepEqual(status.connections, { gmail: true, model: true });
  assert.ok(!JSON.stringify(status).includes("private-"));
});

test("entorno: valida el entorno global; los destinos y remitentes se guardan por proyecto", () => {
  const authenticatedUrl = new URL(complete.MODEL_BASE_URL);
  authenticatedUrl.username = complete.GOOGLE_CLIENT_SECRET;
  authenticatedUrl.password = complete.MODEL_API_KEY;
  const status = environmentStatus({ ...complete,
    GITHUB_REPO: "invalid", GITHUB_ISSUE_NUMBER: "-1", GMAIL_AFTER: "invalid", ALLOWED_SENDER: "invalid",
    MODEL_BASE_URL: authenticatedUrl.href,
  });
  assert.equal(status.ready, false);
  assert.deepEqual(status.errors.map(error => error.field), ["MODEL_BASE_URL"]);
  assert.ok(!JSON.stringify(status).includes("private-"));
});

test("entorno: Gmail solo necesita las credenciales; etiqueta y fecha antiguas no bloquean la UI", () => {
  const credentials = { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", MODEL_BASE_URL: "https://model.invalid/v1", MODEL_ID: "model", MODEL_API_KEY: "key" };
  assert.equal(environmentStatus(credentials).ready, true);
  assert.equal(environmentStatus({ ...credentials, GMAIL_LABEL: "\n", GMAIL_AFTER: "invalid" }).ready, true);
  assert.equal(requiredFields.length, 5);
});
