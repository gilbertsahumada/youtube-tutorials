import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, validateProject } from "../src/store.mjs";

const project = { id: "uno", name: "Mi proyecto", repository: "org/repo", issueNumber: 1, delivery: "entrega-1", requirement: "informe" };
async function storage(t) {
  const root = await mkdtemp(join(tmpdir(), "brain-sqlite-"));
  const store = await createStore(root);
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  return { root, store };
}

test("SQLite: persiste proyectos, filtros y selección; no almacena credenciales desde formularios", async t => {
  const { root, store } = await storage(t);
  assert.deepEqual(store.projects(), []);
  store.saveProject(project);
  store.saveProject({ ...project, id: "dos", repository: "org/otro" });
  store.select("dos");
  const first = store.addFilter({ projectId: "uno", kind: "email", value: "Persona@Empresa.com" });
  assert.equal(store.addFilter({ projectId: "uno", kind: "email", value: "persona@empresa.com" }).id, first.id);
  store.addFilter({ projectId: "dos", kind: "domain", value: "empresa.com" });
  assert.throws(() => store.saveProject({ ...project, MODEL_API_KEY: "forbidden" }), /Campo de proyecto/);
  assert.throws(() => store.addFilter({ projectId: "uno", kind: "domain", value: "empresa.com", secret: "forbidden" }), /Campo de filtro/);
  assert.throws(() => store.addFilter({ projectId: "desconocido", kind: "email", value: "a@empresa.com" }), /no encontrado/);
  store.close();
  const reopened = await createStore(root);
  try {
    assert.equal(reopened.selected(), "dos");
    assert.equal(reopened.projects().length, 2);
    assert.equal(reopened.filters().length, 2);
    reopened.removeFilter(first.id, "dos");
    assert.equal(reopened.filters().length, 2, "no elimina un filtro de otro proyecto");
    reopened.removeFilter(first.id, "uno");
    assert.equal(reopened.filters().length, 1);
    assert.equal((await stat(join(root, ".private/company-brain.sqlite"))).mode & 0o777, 0o600);
  } finally { reopened.close(); }
});

test("SQLite: alcance inmutable al capturar, issue único y transacciones sin escrituras parciales", async t => {
  const { store } = await storage(t);
  store.saveProject(project);
  assert.throws(() => store.saveProject({ ...project, id: "dos" }), /issue ya pertenece/);
  store.saveBaseline("uno", { initialEmail: { id: "inicial" } });
  for (const fields of [{ issueNumber: 2 }, { repository: "org/otro" }, { delivery: "otra" }, { requirement: "otro" }]) assert.throws(() => store.saveProject({ ...project, ...fields }), /alcance capturado/);
  store.saveProject({ ...project, name: "Proyecto renombrado" });
  assert.equal(store.project("uno").name, "Proyecto renombrado");
  assert.throws(() => store.transaction(() => {
    store.saveProject({ ...project, id: "rollback", repository: "org/rollback" });
    store.addFilter({ projectId: "rollback", kind: "domain", value: "https://invalid.com" });
  }), /Dominio inválido/);
  assert.equal(store.project("rollback"), undefined);
  assert.equal(store.projects().length, 1);
});

test("formularios: valida destinos y referencias, parametriza el nombre en SQLite", async t => {
  const { store } = await storage(t);
  for (const fields of [{ id: "../escape" }, { delivery: "x\nfoo" }, { requirement: "" }, { repository: "org/repo?query" }, { issueNumber: 0 }, { issueNumber: 1.5 }, { issueNumber: "1e2" }, { name: "\n" }]) assert.throws(() => validateProject({ ...project, ...fields }));
  store.saveProject({ ...project, name: "O'Reilly'); DROP TABLE projects; --" });
  assert.equal(store.project("uno").name, "O'Reilly'); DROP TABLE projects; --");
  assert.equal(store.projects().length, 1);
});
