/**
 * Your data (shared by the Mac file store, the website's D1 store, and `npm run sync`).
 *
 * Everything is stored as items: { c: collection, id, v: JSON text (null = deleted), t: ms of the last change }.
 * When two copies disagree, the newest change to each item wins, so devices and the Mac can merge safely
 * in any order: a stale phone can't wipe out newer progress, and deletions stick (v = null keeps the time).
 *
 *   words     id = Korean word   — words you added and AI words waiting for review
 *   progress  id = card id       — flashcard progress
 *   decks     id = deck id       — saved scan decks
 *   sessions  id = session id    — interpreting sessions (transcripts)
 *   prefs     id = "settings" / "study"
 */
import { removeWord, upsertWord } from "./custom-words.js";

export const COLLECTIONS = ["words", "progress", "decks", "sessions", "prefs"];
/** Collections the browser syncs directly (words go through /api/custom-words so their rules apply). */
export const CLIENT_COLLECTIONS = COLLECTIONS.filter((c) => c !== "words");

export const MAX_ITEMS_PER_REQUEST = 500;
export const MAX_ITEM_BYTES = 1_500_000; // D1 rows top out at 2 MB
const MAX_FUTURE_MS = 24 * 3600 * 1000; // a device with a badly wrong clock can't "win" forever

/** Validate items sent by a browser. Returns { items } or { error }. */
export function parseSyncItems(body, { now = Date.now(), collections = CLIENT_COLLECTIONS } = {}) {
  const list = body?.items;
  if (!Array.isArray(list)) return { error: "Expected { items: [...] }." };
  if (list.length > MAX_ITEMS_PER_REQUEST) return { error: `At most ${MAX_ITEMS_PER_REQUEST} items per request.` };
  const items = [];
  for (const it of list) {
    if (!collections.includes(it?.c)) return { error: `Unknown collection: ${String(it?.c).slice(0, 40)}` };
    if (typeof it.id !== "string" || !it.id || it.id.length > 200) return { error: "Each item needs an id (up to 200 characters)." };
    if (it.v !== null && typeof it.v !== "string") return { error: "v must be JSON text, or null for a deletion." };
    if (it.v !== null) {
      if (it.v.length > MAX_ITEM_BYTES) return { error: `Item ${it.c}/${it.id} is too large to sync.` };
      try {
        JSON.parse(it.v);
      } catch {
        return { error: `Item ${it.c}/${it.id} is not valid JSON.` };
      }
    }
    if (!Number.isFinite(it.t) || it.t <= 0) return { error: "Each item needs a time t (ms)." };
    items.push({ c: it.c, id: it.id, v: it.v, t: Math.min(Math.round(it.t), now + MAX_FUTURE_MS) });
  }
  return { items };
}

/** True if item a should replace item b (newer wins; on a tie the existing one stays). */
export const isNewer = (a, b) => !b || a.t > b.t;

const key = (it) => `${it.c}\u0000${it.id}`;

/**
 * Compare two full copies. Returns { toA, toB }: the items each side is missing or has older.
 * Used by `npm run sync` (A = Mac, B = website).
 */
export function planSync(itemsA, itemsB) {
  const a = new Map(itemsA.map((it) => [key(it), it]));
  const b = new Map(itemsB.map((it) => [key(it), it]));
  const toA = [];
  const toB = [];
  for (const [k, it] of a) if (isNewer(it, b.get(k))) toB.push(it);
  for (const [k, it] of b) if (isNewer(it, a.get(k))) toA.push(it);
  return { toA, toB };
}

// ---------------------------------------------------------------------------
// Words: the existing add/confirm/rename/delete rules, expressed as item changes.
// ---------------------------------------------------------------------------
const wordTime = (w) => Date.parse(w.updatedAt ?? w.reviewedAt ?? w.addedAt ?? "") || 1;

/** Live words (deleted ones skipped), oldest first. */
export function wordsFromItems(items) {
  return items
    .filter((it) => it.c === "words" && it.v !== null)
    .map((it) => {
      try {
        return JSON.parse(it.v);
      } catch {
        return null;
      }
    })
    .filter((w) => w && typeof w.ko === "string" && typeof w.en === "string")
    .sort((x, y) => String(x.addedAt ?? "").localeCompare(String(y.addedAt ?? "")));
}

/** Items for a list of words (used when absorbing an old custom-words.json / D1 row). */
export const wordItems = (words) => words.filter((w) => w?.ko && w?.en).map((w) => ({ c: "words", id: w.ko, v: JSON.stringify(w), t: wordTime(w) }));

function diffWords(before, after, t) {
  const old = new Map(before.map((w) => [w.ko, JSON.stringify(w)]));
  const next = new Map(after.map((w) => [w.ko, JSON.stringify(w)]));
  const changes = [];
  for (const [ko, v] of next) if (old.get(ko) !== v) changes.push({ c: "words", id: ko, v, t });
  for (const ko of old.keys()) if (!next.has(ko)) changes.push({ c: "words", id: ko, v: null, t });
  return changes;
}

/** Add / update / confirm a word. Returns { changes, words } or { error }. */
export function wordUpsertChanges(words, body, now = new Date()) {
  const result = upsertWord(structuredClone(words), body, now.toISOString());
  if (result.error) return { error: result.error };
  return { changes: result.changed ? diffWords(words, result.words, now.getTime()) : [], words: result.words };
}

/** Delete a word. Returns { changes, words }. */
export function wordRemoveChanges(words, ko, now = new Date()) {
  const after = removeWord(words, ko);
  return { changes: diffWords(words, after, now.getTime()), words: after };
}
