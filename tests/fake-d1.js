import { createRequire } from "node:module";

// Node's built-in SQLite (loaded with require because Vite doesn't know this newer built-in module).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

/** A D1-shaped wrapper around real SQLite (what D1 runs), so the website's SQL is tested for real. */
export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)");
  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => db.prepare(sql).run(...params),
  });
  return {
    raw: db,
    prepare: (sql) => statement(sql),
    batch: async (stmts) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
