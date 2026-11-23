/** Custom words on the website: one JSON document in D1 (strongly consistent, one user). */
const KEY = "custom-words";

export async function readWords(db) {
  const row = await db.prepare("SELECT value FROM store WHERE key = ?").bind(KEY).first();
  try {
    const words = row ? JSON.parse(row.value) : [];
    return Array.isArray(words) ? words : [];
  } catch {
    return [];
  }
}

export async function writeWords(db, words) {
  await db
    .prepare("INSERT INTO store (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(KEY, JSON.stringify(words), new Date().toISOString())
    .run();
}
