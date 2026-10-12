import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, normalizeEmail, normalizeFilter, matchesSender, senderProjects } from "../src/filters.mjs";

test("filtros: normaliza direcciones y dominios, incluido IDN, sin admitir URLs ni sufijos", () => {
  assert.equal(normalizeEmail(" Director@EMPRESA.com "), "director@empresa.com");
  assert.equal(normalizeDomain(" @EMPRESA.com "), "empresa.com");
  assert.equal(normalizeDomain("mañana.com"), "xn--maana-pta.com");
  assert.deepEqual(normalizeFilter("domain", "@Equipo.empresa.com"), { kind: "domain", value: "equipo.empresa.com" });
  for (const value of ["https://empresa.com", "empresa.com/path", "empresa.com:80", "empresa.com?query", "empresa.com#fragment", "*.empresa.com", "empresa.com.", "empresa.com\nattack", "empresa.com\0", "empresa", "@empresa", "-mal.com", "a..com", "@@empresa.com"]) assert.throws(() => normalizeDomain(value), /Dominio inválido/, value);
  for (const value of ["Persona <a@empresa.com>", "a@empresa.com,b@empresa.com", "a@@empresa.com", "a\0@empresa.com"]) assert.throws(() => normalizeEmail(value), /Correo inválido/, value);
  assert.throws(() => normalizeFilter("url", "empresa.com"), /Tipo/);
});

test("filtros: correo exacto gana globalmente y un dominio coincide completo", () => {
  const rules = [
    { projectId: "uno", kind: "domain", value: "empresa.com" },
    { projectId: "dos", kind: "domain", value: "empresa.com" },
    { projectId: "tres", kind: "email", value: "persona@empresa.com" },
  ];
  assert.deepEqual(senderProjects("PERSONA@empresa.com", rules), ["tres"]);
  assert.deepEqual(senderProjects("otra@empresa.com", rules), ["dos", "uno"]);
  assert.equal(matchesSender("otra@empresa.com", rules), true);
  for (const address of ["otra@malempresa.com", "otra@empresa.com.evil.com", "otra@equipo.empresa.com", "otra@empresaXcom", "broken"]) {
    assert.equal(matchesSender(address, rules), false, address);
    assert.deepEqual(senderProjects(address, rules), [], address);
  }
  rules.push({ projectId: "dos", kind: "email", value: "persona@empresa.com" });
  assert.deepEqual(senderProjects("persona@empresa.com", rules), ["dos", "tres"]);
  assert.equal(matchesSender("Persona@empresa.com", "persona@empresa.com"), true, "CLI legacy compatible");
  assert.equal(matchesSender("persona@empresa.com", []), false);
});
