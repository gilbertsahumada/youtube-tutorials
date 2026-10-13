import { DatabaseSync } from "node:sqlite";
import { mkdir, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { normalizeFilter, matchesSender } from "./filters.mjs";
import { normalizeAfter, normalizeLabel } from "./mail-settings.mjs";

export const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const projectFields = [
  "id",
  "name",
  "repository",
  "gmailAfter",
  "gmailLabel",
  "autoEnabled",
  "pollSeconds",
];
export function validateProject(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).some((key) => !projectFields.includes(key))
  )
    throw Error("Campo de proyecto inválido.");
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 120 ||
    /[\r\n\0]/.test(input.name)
  )
    throw Error("Nombre de proyecto inválido.");
  if (
    typeof input.repository !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)
  )
    throw Error("El repositorio debe ser owner/repo.");
  const slug =
    input.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 55) || "proyecto";
  const id = input.id ?? slug + "-" + randomUUID().slice(0, 8);
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id))
    throw Error("Identificador de proyecto inválido.");
  const autoEnabled = input.autoEnabled ?? false;
  const pollSeconds = input.pollSeconds ?? 60;
  if (typeof autoEnabled !== "boolean") throw Error("Seguimiento automático inválido.");
  if (!Number.isInteger(pollSeconds) || pollSeconds < 30 || pollSeconds > 3600)
    throw Error("El intervalo debe estar entre 30 y 3600 segundos.");
  return {
    id,
    name: input.name.trim(),
    repository: input.repository,
    gmailAfter: normalizeAfter(input.gmailAfter ?? new Date().toISOString()),
    gmailLabel: normalizeLabel(input.gmailLabel),
    autoEnabled,
    pollSeconds,
  };
}

export async function createStore(root) {
  const directory = resolve(root, ".private");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, "company-brain.sqlite");
  const db = new DatabaseSync(path);
  await chmod(path, 0o600);
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
  const decode = (row) =>
    row && {
      id: row.id,
      name: row.name,
      repository: row.repository,
      gmailAfter: row.gmail_after,
      gmailLabel: row.gmail_label,
      autoEnabled: Boolean(row.auto_enabled),
      pollSeconds: row.poll_seconds,
    };
  const project = (id) =>
    id ? decode(db.prepare("SELECT * FROM projects WHERE id=?").get(id)) : undefined;
  const projects = () => db.prepare("SELECT * FROM projects ORDER BY rowid").all().map(decode);
  const filters = (id) =>
    db
      .prepare(
        "SELECT id,project_id AS projectId,kind,value FROM sender_filters" +
          (id ? " WHERE project_id=?" : "") +
          " ORDER BY id",
      )
      .all(...(id ? [id] : []))
      .map((row) => ({ ...row }));
  const runtime = (id) => {
    const row = db.prepare("SELECT data FROM project_runtime WHERE project_id=?").get(id);
    return row ? JSON.parse(row.data) : {};
  };
  const setRuntime = (id, fields) =>
    db
      .prepare(
        "INSERT INTO project_runtime VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data",
      )
      .run(id, JSON.stringify({ ...runtime(id), ...fields }));
  const event = (id, title, detail) =>
    db
      .prepare("INSERT INTO events(project_id,title,detail,date) VALUES(?,?,?,?)")
      .run(id, title, detail, new Date().toISOString());
  const selected = () =>
    db.prepare("SELECT value FROM metadata WHERE key='selected_project'").get()?.value || null;
  const select = (id) => {
    if (!project(id)) throw Error("Proyecto no encontrado.");
    db.prepare(
      "INSERT INTO metadata VALUES('selected_project',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run(id);
  };
  const proposalRow = (row) =>
    row && {
      ...JSON.parse(row.data),
      id: row.id,
      projectId: row.project_id,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : null,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  const proposals = (id) =>
    db
      .prepare(
        "SELECT * FROM proposals" +
          (id ? " WHERE project_id=?" : "") +
          " ORDER BY created_at DESC,rowid DESC",
      )
      .all(...(id ? [id] : []))
      .map(proposalRow);
  const proposal = (id) => proposalRow(db.prepare("SELECT * FROM proposals WHERE id=?").get(id));
  const mails = (id) =>
    db
      .prepare(
        "SELECT data,hash,analyzed_hash FROM synced_mail WHERE project_id=? ORDER BY json_extract(data,'$.date'),email_id",
      )
      .all(id)
      .map((row) => ({
        ...JSON.parse(row.data),
        hash: row.hash,
        analyzed: row.hash === row.analyzed_hash,
      }));
  const invalidatePending = (id, reason) =>
    db
      .prepare(
        "UPDATE proposals SET status='stale',error=?,updated_at=? WHERE project_id=? AND status='pending'",
      )
      .run(reason, new Date().toISOString(), id);
  const invalidateMailbox = (id) => {
    db.prepare("DELETE FROM synced_mail WHERE project_id=?").run(id);
    setRuntime(id, { lastSync: null, lastAnalysis: null, summary: null, error: null });
    invalidatePending(id, "Cambió la configuración. Sincroniza y analiza de nuevo.");
  };
  const existingTables = () =>
    new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
  let closed = false;
  return {
    project,
    projects,
    filters,
    selected,
    select,
    transaction,
    runtime,
    setRuntime,
    event,
    mails,
    proposal,
    proposals,
    invalidatePending,
    saveProject(input) {
      const previous = project(input?.id);
      const value = validateProject({ ...(previous || {}), ...input });
      return transaction(() => {
        db.prepare(
          "INSERT INTO projects VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,repository=excluded.repository,gmail_after=excluded.gmail_after,gmail_label=excluded.gmail_label,auto_enabled=excluded.auto_enabled,poll_seconds=excluded.poll_seconds",
        ).run(
          value.id,
          value.name,
          value.repository,
          value.gmailAfter,
          value.gmailLabel,
          Number(value.autoEnabled),
          value.pollSeconds,
        );
        if (previous && ["gmailAfter", "gmailLabel"].some((key) => previous[key] !== value[key]))
          invalidateMailbox(value.id);
        if (previous && ["name", "repository"].some((key) => previous[key] !== value[key])) {
          invalidatePending(value.id, "Cambió el proyecto o repositorio. Analiza de nuevo.");
          db.prepare("UPDATE synced_mail SET analyzed_hash=NULL WHERE project_id=?").run(value.id);
          setRuntime(value.id, { issues: [], issueDigest: null, lastAnalysis: null });
          if (previous.repository !== value.repository)
            db.prepare("DELETE FROM issue_links WHERE project_id=?").run(value.id);
        }
        if (!selected()) select(value.id);
        return value;
      });
    },
    addFilter(input) {
      if (!input || Object.keys(input).some((key) => !["projectId", "kind", "value"].includes(key)))
        throw Error("Campo de filtro inválido.");
      if (!project(input.projectId)) throw Error("Proyecto no encontrado.");
      const rule = normalizeFilter(input.kind, input.value);
      return transaction(() => {
        const result = db
          .prepare(
            "INSERT INTO sender_filters(project_id,kind,value) VALUES(?,?,?) ON CONFLICT(project_id,kind,value) DO NOTHING",
          )
          .run(input.projectId, rule.kind, rule.value);
        if (result.changes) invalidateMailbox(input.projectId);
        return filters(input.projectId).find(
          (item) => item.kind === rule.kind && item.value === rule.value,
        );
      });
    },
    removeFilter(id, projectId) {
      if (!Number.isSafeInteger(id) || !project(projectId)) throw Error("Filtro inválido.");
      return transaction(() => {
        const result = db
          .prepare("DELETE FROM sender_filters WHERE id=? AND project_id=?")
          .run(id, projectId);
        if (result.changes) invalidateMailbox(projectId);
        return { removed: result.changes > 0 };
      });
    },
    replaceMail(projectId, emails) {
      const scope = project(projectId),
        rules = filters(projectId),
        now = new Date().toISOString();
      const scoped = emails.filter(
        (mail) =>
          matchesSender(mail.from, rules) && Date.parse(mail.date) >= Date.parse(scope.gmailAfter),
      );
      const before = new Map(mails(projectId).map((mail) => [mail.id, mail.hash]));
      const current = new Map();
      transaction(() => {
        for (const email of scoped) {
          const { id, from, subject, date, text } = email;
          if (
            typeof id !== "string" ||
            typeof text !== "string" ||
            !Number.isFinite(Date.parse(date))
          )
            throw Error("Correo inválido.");
          const data = {
            id,
            threadId: email.threadId || id,
            from,
            subject: subject || "",
            date,
            text,
          };
          const hash = digest(data);
          current.set(id, hash);
          db.prepare(
            "INSERT INTO synced_mail VALUES(?,?,?,?,NULL,?) ON CONFLICT(project_id,email_id) DO UPDATE SET data=excluded.data,hash=excluded.hash,analyzed_hash=CASE WHEN synced_mail.hash=excluded.hash THEN synced_mail.analyzed_hash ELSE NULL END,synced_at=excluded.synced_at",
          ).run(projectId, id, JSON.stringify(data), hash, now);
        }
        for (const id of before.keys())
          if (!current.has(id))
            db.prepare("DELETE FROM synced_mail WHERE project_id=? AND email_id=?").run(
              projectId,
              id,
            );
        for (const item of proposals(projectId).filter((item) => item.status === "pending")) {
          const threads = new Set(item.sources.map((source) => source.threadId));
          const newReply = scoped.some(
            (mail) =>
              threads.has(mail.threadId || mail.id) && before.get(mail.id) !== current.get(mail.id),
          );
          if (newReply || item.sources.some((source) => current.get(source.id) !== source.hash)) {
            db.prepare("UPDATE proposals SET status='stale',error=?,updated_at=? WHERE id=?").run(
              "Las fuentes cambiaron. Analiza de nuevo.",
              now,
              item.id,
            );
            for (const source of item.sources)
              db.prepare(
                "UPDATE synced_mail SET analyzed_hash=NULL WHERE project_id=? AND email_id=?",
              ).run(projectId, source.id);
          }
        }
        setRuntime(projectId, { lastSync: now, error: null });
      });
      return {
        total: current.size,
        added: [...current].filter(([id, hash]) => before.get(id) !== hash).length,
      };
    },
    markAnalyzed(id, emails) {
      for (const email of emails)
        db.prepare(
          "UPDATE synced_mail SET analyzed_hash=? WHERE project_id=? AND email_id=? AND hash=?",
        ).run(email.hash, id, email.id, email.hash);
    },
    markUnanalyzed(id, emailIds) {
      for (const emailId of emailIds)
        db.prepare(
          "UPDATE synced_mail SET analyzed_hash=NULL WHERE project_id=? AND email_id=?",
        ).run(id, emailId);
    },
    saveProposal(data) {
      const existing = db
        .prepare("SELECT id,status FROM proposals WHERE generation_key=?")
        .get(data.generationKey);
      if (existing && existing.status !== "stale") return proposal(existing.id);
      if (existing)
        db.prepare("UPDATE proposals SET generation_key=? WHERE id=?").run(
          data.generationKey + ":stale:" + existing.id,
          existing.id,
        );
      const id = randomUUID(),
        now = new Date().toISOString();
      db.prepare("INSERT INTO proposals VALUES(?,?,?,?,'pending',NULL,NULL,?,?)").run(
        id,
        data.projectId,
        data.generationKey,
        JSON.stringify(data),
        now,
        now,
      );
      return proposal(id);
    },
    setProposal(id, status, { result = null, error = null } = {}) {
      if (!["pending", "approved", "rejected", "stale"].includes(status))
        throw Error("Estado de propuesta inválido.");
      db.prepare("UPDATE proposals SET status=?,result=?,error=?,updated_at=? WHERE id=?").run(
        status,
        result && JSON.stringify(result),
        error,
        new Date().toISOString(),
        id,
      );
      return proposal(id);
    },
    link(id, threadId, number) {
      db.prepare(
        "INSERT INTO issue_links VALUES(?,?,?) ON CONFLICT(project_id,thread_id) DO UPDATE SET issue_number=excluded.issue_number",
      ).run(id, threadId, number);
    },
    links(id) {
      return db
        .prepare(
          "SELECT thread_id AS threadId,issue_number AS issueNumber FROM issue_links WHERE project_id=?",
        )
        .all(id)
        .map((row) => ({ ...row }));
    },
    events(id) {
      return db
        .prepare(
          "SELECT title,detail,date FROM events WHERE project_id=? ORDER BY id DESC LIMIT 100",
        )
        .all(id)
        .map((row) => ({ ...row }));
    },
    deleteProject(id) {
      if (!project(id)) throw Error("Proyecto no encontrado.");
      transaction(() => {
        const tables = existingTables();
        for (const name of [
          "issue_links",
          "proposals",
          "synced_mail",
          "project_runtime",
          "sender_filters",
          "events",
          "baselines",
          "mail_records",
        ]) {
          if (tables.has(name)) db.prepare("DELETE FROM " + name + " WHERE project_id=?").run(id);
        }
        if (tables.has("assignments"))
          db.prepare("DELETE FROM assignments WHERE project_id=?").run(id);
        db.prepare("DELETE FROM projects WHERE id=?").run(id);
        if (selected() === id) {
          db.prepare("DELETE FROM metadata WHERE key='selected_project'").run();
          const next = projects()[0];
          if (next) select(next.id);
        }
      });
    },
    reset() {
      transaction(() => {
        const tables = existingTables();
        for (const name of [
          "issue_links",
          "proposals",
          "synced_mail",
          "project_runtime",
          "sender_filters",
          "events",
          "baselines",
          "mail_records",
          "assignments",
          "metadata",
          "projects",
        ]) {
          if (tables.has(name)) db.exec("DELETE FROM " + name);
        }
      });
      return { reset: true };
    },
    close() {
      if (!closed) {
        db.close();
        closed = true;
      }
    },
  };
}
