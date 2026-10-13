import { normalizeAfter } from "../mail-settings.mjs";

/** Inicializa el esquema v3 conservando los IDs y datos existentes.
 * Las migraciones se ejecutan en una transacción antes de activar las referencias.
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {(action: Function) => *} Ejecutor de transacciones sincronizadas.
 */
export function initializeSchema(db) {
  db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=OFF;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 3) {
    db.close();
    throw Error("La base local requiere una versión más reciente de la demo.");
  }
  const hasProjects = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get(),
  );
  const transaction = (action) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  if (version < 3) {
    try {
      transaction(() => {
        db.exec(
          "CREATE TABLE projects_next (id TEXT PRIMARY KEY, name TEXT NOT NULL, repository TEXT NOT NULL, gmail_after TEXT NOT NULL, gmail_label TEXT NOT NULL DEFAULT '', auto_enabled INTEGER NOT NULL DEFAULT 0, poll_seconds INTEGER NOT NULL DEFAULT 60) STRICT;",
        );
        if (hasProjects) {
          const columns = db
            .prepare("PRAGMA table_info(projects)")
            .all()
            .map((row) => row.name);
          const insert = db.prepare(
            "INSERT INTO projects_next(id,name,repository,gmail_after,gmail_label) VALUES(?,?,?,?,?)",
          );
          for (const row of db.prepare("SELECT * FROM projects").all()) {
            let after = new Date().toISOString();
            if (columns.includes("gmail_after") && row.gmail_after)
              after = normalizeAfter(row.gmail_after);
            else if (db.prepare("SELECT name FROM sqlite_master WHERE name='baselines'").get()) {
              const saved = db.prepare("SELECT data FROM baselines WHERE project_id=?").get(row.id);
              const date = saved && JSON.parse(saved.data).initialEmail?.date;
              if (date) after = normalizeAfter(date);
            }
            insert.run(row.id, row.name, row.repository, after, row.gmail_label || "");
          }
          db.exec("DROP TABLE projects;");
        }
        db.exec("ALTER TABLE projects_next RENAME TO projects; PRAGMA user_version=3;");
      });
    } catch (error) {
      db.close();
      throw error;
    }
  }
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS sender_filters (id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL CHECK(kind IN ('email','domain')), value TEXT NOT NULL, UNIQUE(project_id,kind,value)) STRICT;" +
      "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;" +
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, detail TEXT NOT NULL, date TEXT NOT NULL) STRICT;" +
      "CREATE TABLE IF NOT EXISTS synced_mail (project_id TEXT NOT NULL REFERENCES projects(id), email_id TEXT NOT NULL, data TEXT NOT NULL, hash TEXT NOT NULL, analyzed_hash TEXT, synced_at TEXT NOT NULL, PRIMARY KEY(project_id,email_id)) STRICT;" +
      "CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), generation_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','stale')), result TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT;" +
      "CREATE TABLE IF NOT EXISTS project_runtime (project_id TEXT PRIMARY KEY REFERENCES projects(id), data TEXT NOT NULL) STRICT;" +
      "CREATE TABLE IF NOT EXISTS issue_links (project_id TEXT NOT NULL REFERENCES projects(id), thread_id TEXT NOT NULL, issue_number INTEGER NOT NULL, PRIMARY KEY(project_id,thread_id)) STRICT;" +
      "CREATE INDEX IF NOT EXISTS proposals_project_status ON proposals(project_id,status);" +
      "CREATE INDEX IF NOT EXISTS synced_mail_project ON synced_mail(project_id);",
  );
  return transaction;
}
