import assert from "node:assert/strict";
import test from "node:test";

import { toCsv } from "../src/csv.js";

test("genera una fila normal", () => {
  const csv = toCsv([
    {
      fecha: "2026-07-14",
      cliente: "Ana Pérez",
      servicio: "Corte",
    },
  ]);

  assert.equal(
    csv,
    "Fecha,Cliente,Servicio\n2026-07-14,Ana Pérez,Corte",
  );
});

test("escapa comas y comillas", () => {
  const csv = toCsv([
    {
      fecha: "2026-07-14",
      cliente: 'Ana, "La Jefa"',
      servicio: "Corte, color",
    },
  ]);

  assert.equal(
    csv,
    'Fecha,Cliente,Servicio\n2026-07-14,"Ana, ""La Jefa""","Corte, color"',
  );
});

test("una lista vacía conserva el encabezado", () => {
  assert.equal(toCsv([]), "Fecha,Cliente,Servicio");
});
