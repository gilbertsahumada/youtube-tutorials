import test from "node:test";
import assert from "node:assert/strict";
import { readResponse } from "../web/http.js";

test("UI: interpreta la confirmación JSON de selección y eliminación", async () => {
  for (const value of [{ projectId: "ventas" }, { removed: true }]) {
    assert.deepEqual(await readResponse(Response.json(value)), value);
  }
});

test("UI: respuestas vacías o inválidas muestran una instrucción para recuperar la conexión", async () => {
  for (const body of ["", "<html>Error del servidor</html>", "{", "null"]) {
    await assert.rejects(readResponse(new Response(body)), /Reinicia la demo y recarga la página/);
  }
});

test("UI: conserva errores de la API y el estado de configuración que permite corregirlos", async () => {
  const payload = {
    error: "Faltan variables de entorno: MODEL_ID",
    config: { ready: false, missing: ["MODEL_ID"] },
  };
  await assert.rejects(readResponse(Response.json(payload, { status: 503 })), (error) => {
    assert.equal(error.message, payload.error);
    assert.deepEqual(error.payload, payload);
    return true;
  });
});
