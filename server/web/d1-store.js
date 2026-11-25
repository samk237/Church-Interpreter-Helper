/**
 * Website storage: one row per item in Cloudflare D1 (see server/core/user-data.js for the model).
 * Writes use a single statement that only replaces a row when the incoming change is newer, so
 * phones, the PC and `npm run sync` can all write at once without losing each other's changes.
 * Works with the real D1 binding and with anything shaped like it (the sync script's REST client, tests).
 */
import { wordItems } from "../core/user-data.js";

export const ITEMS_SCHEMA =
  "CREATE TABLE IF NOT EXISTS items (c TEXT NOT NULL, id TEXT NOT NULL, v TEXT, t INTEGER NOT NULL, PRIMARY KEY (c, id))";

const UPSERT = `INSERT INTO items (c, id, v, t)
  SELECT json_extract(value, '$.c'), json_extract(value, '$.id'), json_extract(value, '$.v'), json_extract(value, '$.t')
  FROM json_each(?) WHERE 1
  ON CONFLICT (c, id) DO UPDATE SET v = excluded.v, t = excluded.t WHERE excluded.t > items.t`;

const MAX_CHUNK_BYTES = 1_800_000; // one bound value must stay under D1's 2 MB limit

/** Split items into chunks that each fit in one statement. */
export function chunkItems(items) {
  const chunks = [];
  let cur = [];
  let size = 2;
  for (const it of items) {
    const n = (it.v?.length ?? 4) + it.id.length + it.c.length + 40;
    if (cur.length && size + n > MAX_CHUNK_BYTES) {
      chunks.push(cur);
      cur = [];
      size = 2;
    }
    cur.push(it);
    size += n;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

const ready = new WeakMap();

/** readOnly: never write (no table creation or upgrade), e.g. for `npm run sync -- --dry-run`. */
export function createD1Store(db, { readOnly = false } = {}) {
  // Create the table on first use, and absorb words saved by the first website version (one JSON row in `store`).
  function ensure() {
    if (readOnly) return Promise.resolve();
    if (!ready.has(db)) {
      const p = (async () => {
        await db.prepare(ITEMS_SCHEMA).run();
        let row = null;
        try {
          row = await db.prepare("SELECT value FROM store WHERE key = 'custom-words'").first();
        } catch {
          /* no legacy table */
        }
        if (!row) return;
        let words = [];
        try {
          words = JSON.parse(row.value);
        } catch {
          /* unreadable — drop it */
        }
        const items = Array.isArray(words) ? wordItems(words) : [];
        await db.batch([
          ...chunkItems(items).map((chunk) => db.prepare(UPSERT).bind(JSON.stringify(chunk))),
          db.prepare("DELETE FROM store WHERE key = 'custom-words'"),
        ]);
      })();
      p.catch(() => ready.delete(db));
      ready.set(db, p);
    }
    return ready.get(db);
  }

  return {
    async list({ collections } = {}) {
      await ensure();
      const stmt = collections
        ? db.prepare("SELECT c, id, v, t FROM items WHERE c IN (SELECT value FROM json_each(?))").bind(JSON.stringify(collections))
        : db.prepare("SELECT c, id, v, t FROM items");
      const { results } = await stmt.all();
      return results.map((r) => ({ c: r.c, id: r.id, v: r.v ?? null, t: Number(r.t) }));
    },
    async put(items) {
      if (!items.length) return;
      await ensure();
      const stmts = chunkItems(items).map((chunk) => db.prepare(UPSERT).bind(JSON.stringify(chunk)));
      if (stmts.length === 1) await stmts[0].run();
      else await db.batch(stmts);
    },
  };
}
