import { DatabaseSync } from "node:sqlite";
import { mkdir, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeFilter } from "./filters.mjs";

const projectFields = ["id", "name", "repository", "issueNumber", "delivery", "requirement"];
export function validateProject(input) {
  if (!input || typeof input !== "object" || Object.keys(input).some(key => !projectFields.includes(key))) throw Error("Campo de proyecto inválido.");
  const identifier = key => {
    if (typeof input[key] !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(input[key])) throw Error("Usa identificadores con letras minúsculas, números y guiones.");
    return input[key];
  };
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 || /[\r\n\0]/.test(input.name)) throw Error("Nombre de proyecto inválido.");
  if (typeof input.repository !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(input.repository)) throw Error("El repositorio debe ser owner/repo.");
  if (!/^\d+$/.test(String(input.issueNumber)) || !Number.isSafeInteger(Number(input.issueNumber)) || Number(input.issueNumber) < 1) throw Error("El número del issue debe ser un entero positivo.");
  return { id: identifier("id"), name: input.name.trim(), repository: input.repository, issueNumber: Number(input.issueNumber), delivery: identifier("delivery"), requirement: identifier("requirement"), allowedFormats: ["CSV", "PDF"] };
}
export const projectContext = ({ id, name, delivery, requirement, allowedFormats }) => ({ id, name, delivery, requirement, allowedFormats });

export async function createStore(root) {
  const directory = resolve(root, ".private");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, "company-brain.sqlite");
  const db = new DatabaseSync(path);
  let closed = false;
  await chmod(path, 0o600);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 1) { db.close(); throw Error("La base local requiere una versión más reciente de la demo."); }
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, repository TEXT NOT NULL,
      issue_number INTEGER NOT NULL, delivery TEXT NOT NULL, requirement TEXT NOT NULL,
      UNIQUE(repository, issue_number)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sender_filters (
      id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      kind TEXT NOT NULL CHECK(kind IN ('email', 'domain')), value TEXT NOT NULL,
      UNIQUE(project_id, kind, value)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS baselines (
      project_id TEXT PRIMARY KEY REFERENCES projects(id), data TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS mail_records (
      project_id TEXT NOT NULL REFERENCES projects(id), email_id TEXT NOT NULL,
      entry TEXT NOT NULL, published TEXT, PRIMARY KEY(project_id, email_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS assignments (
      email_id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL, detail TEXT NOT NULL, date TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    PRAGMA user_version = 1;
  `);
  const decode = row => row && ({ id: row.id, name: row.name, repository: row.repository, issueNumber: row.issue_number, delivery: row.delivery, requirement: row.requirement, allowedFormats: ["CSV", "PDF"] });
  const transaction = action => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = action(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const baseline = id => { const row = db.prepare("SELECT data FROM baselines WHERE project_id = ?").get(id); return row ? JSON.parse(row.data) : null; };
  const project = id => decode(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
  const selected = () => db.prepare("SELECT value FROM metadata WHERE key = 'selected_project'").get()?.value || null;
  const select = id => {
    if (!project(id)) throw Error("Proyecto no encontrado.");
    db.prepare("INSERT INTO metadata(key,value) VALUES('selected_project',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(id);
  };
  function saveProject(input) {
    const value = validateProject(input);
    const previous = project(value.id);
    if (baseline(value.id) && ["repository", "issueNumber", "delivery", "requirement"].some(key => value[key] !== previous[key])) throw Error("El alcance capturado no puede cambiar. Crea otro proyecto.");
    try {
      db.prepare(`INSERT INTO projects VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, repository=excluded.repository,
        issue_number=excluded.issue_number, delivery=excluded.delivery, requirement=excluded.requirement`).run(value.id, value.name, value.repository, value.issueNumber, value.delivery, value.requirement);
    } catch (error) {
      if (error.message.includes("UNIQUE")) throw Error("Ese issue ya pertenece a otro proyecto.");
      throw error;
    }
    if (!selected()) select(value.id);
    return value;
  }
  function addFilter(input) {
    if (!input || typeof input !== "object" || Object.keys(input).some(key => !["projectId", "kind", "value"].includes(key))) throw Error("Campo de filtro inválido.");
    if (!project(input.projectId)) throw Error("Proyecto no encontrado.");
    const rule = normalizeFilter(input.kind, input.value);
    db.prepare("INSERT INTO sender_filters(project_id,kind,value) VALUES(?,?,?) ON CONFLICT(project_id,kind,value) DO NOTHING").run(input.projectId, rule.kind, rule.value);
    return filters().find(row => row.projectId === input.projectId && row.kind === rule.kind && row.value === rule.value);
  }
  const filters = () => db.prepare("SELECT id, project_id AS projectId, kind, value FROM sender_filters ORDER BY id").all().map(row => ({ ...row }));
  return {
    project, selected, select, saveProject, addFilter, filters, baseline, transaction,
    projects: () => db.prepare("SELECT * FROM projects ORDER BY rowid").all().map(decode),
    removeFilter(id, projectId) {
      if (!Number.isSafeInteger(id) || !project(projectId)) throw Error("Filtro inválido.");
      db.prepare("DELETE FROM sender_filters WHERE id = ? AND project_id = ?").run(id, projectId);
    },
    saveBaseline: (id, data) => db.prepare("INSERT INTO baselines VALUES(?,?)").run(id, JSON.stringify(data)),
    records: id => db.prepare("SELECT entry,published FROM mail_records WHERE project_id = ? ORDER BY rowid").all(id).map(row => ({ ...JSON.parse(row.entry), ...(row.published ? { published: JSON.parse(row.published) } : {}) })),
    saveRecord: (id, emailId, entry) => db.prepare("INSERT INTO mail_records(project_id,email_id,entry) VALUES(?,?,?) ON CONFLICT(project_id,email_id) DO UPDATE SET entry=excluded.entry").run(id, emailId, JSON.stringify(entry)),
    publish: (id, emailId, result) => db.prepare("UPDATE mail_records SET published=? WHERE project_id=? AND email_id=?").run(JSON.stringify(result), id, emailId),
    event: (id, title, detail) => db.prepare("INSERT INTO events(project_id,title,detail,date) VALUES(?,?,?,?)").run(id, title, detail, new Date().toISOString()),
    events: id => db.prepare("SELECT title,detail,date FROM events WHERE project_id=? ORDER BY id DESC LIMIT 30").all(id).map(row => ({ ...row })),
    assignment: emailId => db.prepare("SELECT project_id FROM assignments WHERE email_id=?").get(emailId)?.project_id,
    assign: (emailId, id) => db.prepare("INSERT INTO assignments VALUES(?,?) ON CONFLICT(email_id) DO UPDATE SET project_id=excluded.project_id").run(emailId, id),
    metadata: key => db.prepare("SELECT value FROM metadata WHERE key=?").get(key)?.value,
    setMetadata: (key, value) => db.prepare("INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value),
    close: () => { if (!closed) { db.close(); closed = true; } },
  };
}
