/**
 * The data API, shared by the Mac server and the website. Each handler takes a store
 * ({ list, put }) and returns { status, body }.
 *
 *   GET    /api/custom-words          -> { words }
 *   POST   /api/custom-words          -> add / update / confirm a word
 *   DELETE /api/custom-words?ko=...   -> delete a word
 *   GET    /api/sync                  -> { items } everything except words
 *   POST   /api/sync  { items }       -> save changes (newest change per item wins)
 */
import { CLIENT_COLLECTIONS, parseSyncItems, wordRemoveChanges, wordsFromItems, wordUpsertChanges } from "./user-data.js";

const WORDS = { collections: ["words"] };

export async function getWords(store) {
  return { status: 200, body: { words: wordsFromItems(await store.list(WORDS)) } };
}

export async function postWord(store, body, now = new Date()) {
  const items = await store.list(WORDS);
  const words = wordsFromItems(items);
  // An AI suggestion for a word you deleted or rejected isn't saved again.
  const ko = String(body?.ko ?? "").trim();
  if (body?.status === "ai" && items.some((it) => it.id === ko && it.v === null)) return { status: 200, body: { words } };
  const result = wordUpsertChanges(words, body, now);
  if (result.error) return { status: 400, body: { error: result.error } };
  if (result.changes.length) await store.put(result.changes);
  return { status: 200, body: { words: result.words } };
}

export async function deleteWord(store, ko, now = new Date()) {
  const result = wordRemoveChanges(wordsFromItems(await store.list(WORDS)), ko, now);
  if (result.changes.length) await store.put(result.changes);
  return { status: 200, body: { words: result.words } };
}

export async function getSync(store) {
  return { status: 200, body: { items: await store.list({ collections: CLIENT_COLLECTIONS }) } };
}

export async function postSync(store, body, now = Date.now()) {
  const parsed = parseSyncItems(body, { now });
  if (parsed.error) return { status: 400, body: { error: parsed.error } };
  await store.put(parsed.items);
  return { status: 200, body: { ok: true, saved: parsed.items.length } };
}
