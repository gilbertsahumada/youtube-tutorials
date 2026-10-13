import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore, validateProject } from "../src/store.mjs";
import { project, initial, reply } from "./support/workflow.mjs";
async function storage(t) {
  const root = await mkdtemp(join(tmpdir(), "brain-sqlite-"));
  const store = await createStore(root);
  t.after(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, store };
}
const proposal = (mail) => ({
  projectId: project.id,
  generationKey: "request-key",
  sources: [{ id: mail.id, hash: mail.hash, threadId: mail.threadId }],
  action: "create_issue",
});
test("proyecto sin issue: genera ID, conserva hora y permite compartir repositorio", async (t) => {
  const { root, store } = await storage(t);
  const input = { ...project };
  delete input.id;
  const generated = store.saveProject(input);
  assert.match(generated.id, /^portal-[a-f0-9]{8}$/);
  store.saveProject(project);
  assert.equal(store.project(project.id).gmailAfter, "2026-10-12T09:30:15.000Z");
  assert.equal(store.projects().length, 2);
  store.select(project.id);
  store.addFilter({ projectId: project.id, kind: "domain", value: "@LIVE.CL" });
  store.close();
  const reopened = await createStore(root);
  try {
    assert.equal(reopened.selected(), project.id);
    assert.equal(reopened.filters()[0].value, "live.cl");
  } finally {
    reopened.close();
  }
  assert.equal((await stat(join(root, ".private/company-brain.sqlite"))).mode & 0o777, 0o600);
});
test("formularios rechazan secretos y destinos inválidos; nombres se parametrizan", async (t) => {
  const { store } = await storage(t);
  for (const fields of [
    { repository: "org/repo?x" },
    { name: "\n" },
    { id: "../escape" },
    { gmailAfter: "2026-02-30" },
    { gmailLabel: "a\nb" },
    { MODEL_API_KEY: "secret" },
    { issueNumber: 1 },
    { autoEnabled: "true" },
    { pollSeconds: 0 },
  ])
    assert.throws(() => validateProject({ ...project, ...fields }));
  store.saveProject({ ...project, name: "O'Reilly'); DROP TABLE projects; --" });
  assert.equal(store.projects().length, 1);
  assert.throws(() =>
    store.addFilter({
      projectId: project.id,
      kind: "email",
      value: "a@live.cl",
      secret: "invalid",
    }),
  );
});
test("sincronización comprueba dominio y hora, conserva análisis y retira fuentes fuera de alcance", async (t) => {
  const { store } = await storage(t);
  store.saveProject(project);
  store.addFilter({ projectId: project.id, kind: "domain", value: "live.cl" });
  assert.deepEqual(
    store.replaceMail(project.id, [
      initial,
      { ...initial, id: "old", date: "2026-10-12T09:30:14Z" },
      { ...initial, id: "spoof", from: "x@live.cl.evil.com" },
    ]),
    { total: 1, added: 1 },
  );
  store.markAnalyzed(project.id, store.mails(project.id));
  const saved = store.saveProposal(proposal(store.mails(project.id)[0]));
  assert.deepEqual(store.replaceMail(project.id, [initial]), { total: 1, added: 0 });
  assert.equal(store.mails(project.id)[0].analyzed, true);
  store.replaceMail(project.id, []);
  assert.equal(store.proposal(saved.id).status, "stale");
  assert.equal(store.mails(project.id).length, 0);
});
test("una respuesta nueva invalida la propuesta del hilo y vuelve a analizar sus fuentes", async (t) => {
  const { store } = await storage(t);
  store.saveProject(project);
  store.addFilter({ projectId: project.id, kind: "domain", value: "live.cl" });
  store.replaceMail(project.id, [initial]);
  const saved = store.saveProposal(proposal(store.mails(project.id)[0]));
  store.markAnalyzed(project.id, store.mails(project.id));
  store.replaceMail(project.id, [initial, reply]);
  assert.equal(store.proposal(saved.id).status, "stale");
  assert.ok(store.mails(project.id).every((mail) => !mail.analyzed));
  const regenerated = store.saveProposal(proposal(store.mails(project.id)[0]));
  assert.notEqual(regenerated.id, saved.id);
  assert.equal(store.proposal(saved.id).status, "stale");
  store.setProposal(regenerated.id, "rejected");
  assert.equal(
    store.saveProposal(proposal(store.mails(project.id)[0])).id,
    regenerated.id,
    "una decisión rechazada no reaparece automáticamente",
  );
});
test("editar alcance limpia caché y cambiar repositorio retira vínculos; filtros respetan el proyecto", async (t) => {
  const { store } = await storage(t);
  store.saveProject(project);
  store.saveProject({ ...project, id: "otro" });
  const filter = store.addFilter({ projectId: project.id, kind: "domain", value: "live.cl" });
  store.replaceMail(project.id, [initial]);
  const saved = store.saveProposal(proposal(store.mails(project.id)[0]));
  store.link(project.id, initial.threadId, 8);
  store.removeFilter(filter.id, "otro");
  assert.equal(store.mails(project.id).length, 1);
  store.saveProject({ id: project.id, repository: "org/new" });
  assert.equal(store.proposal(saved.id).status, "stale");
  assert.deepEqual(store.links(project.id), []);
  store.saveProject({ id: project.id, gmailAfter: "2026-10-12T11:00:00Z" });
  assert.deepEqual(store.mails(project.id), []);
  assert.equal(store.runtime(project.id).lastSync, null);
});
test("schema v2: quita el issue único y conserva proyectos, participantes y selección", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "brain-migrate-"));
  await mkdir(join(root, ".private"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = new DatabaseSync(join(root, ".private/company-brain.sqlite"));
  old.exec(
    "CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,repository TEXT,issue_number INTEGER,delivery TEXT,requirement TEXT,gmail_after TEXT,gmail_label TEXT,UNIQUE(repository,issue_number)); CREATE TABLE sender_filters(id INTEGER PRIMARY KEY,project_id TEXT REFERENCES projects(id),kind TEXT,value TEXT,UNIQUE(project_id,kind,value)); CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE baselines(project_id TEXT PRIMARY KEY REFERENCES projects(id),data TEXT); INSERT INTO projects VALUES('portal','Portal','org/portal',1,'one','csv','2026-10-12T09:30:15Z',''); INSERT INTO sender_filters VALUES(1,'portal','domain','live.cl'); INSERT INTO metadata VALUES('selected_project','portal'); INSERT INTO baselines VALUES('portal','{}'); PRAGMA user_version=2;",
  );
  old.close();
  const store = await createStore(root);
  try {
    assert.equal(store.project(project.id).gmailAfter, "2026-10-12T09:30:15.000Z");
    assert.equal(store.selected(), project.id);
    assert.equal(store.filters()[0].value, "live.cl");
    store.saveProject({ ...project, id: "second" });
    assert.equal(store.projects().length, 2);
    store.deleteProject(project.id);
    assert.equal(store.selected(), "second");
    store.reset();
    assert.deepEqual(store.projects(), []);
    assert.deepEqual(store.filters(), []);
    assert.equal(store.selected(), null);
  } finally {
    store.close();
  }
});
