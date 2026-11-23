/**
 * Your data — flashcard progress, saved decks, sessions, settings — is kept on the server
 * (Cloudflare on the website, data/my-data.json on the Mac) so every device shares it.
 * This browser keeps a copy so the app opens instantly and keeps working offline:
 *   - changes are saved here at once and sent to the server right away (retried later if offline);
 *   - other devices' changes are fetched when the app opens and whenever it comes back to the front.
 * Each item remembers when it last changed; the newest change wins.
 * (Words have their own API — see state.js.)
 */
const COLLECTIONS = ["progress", "decks", "sessions", "prefs"];
const cacheKey = (c) => `cih.data.v2.${c}`;
const PENDING_KEY = "cih.pending.v2";
const MAX_ITEM_CHARS = 1_400_000;
const MAX_BATCH_CHARS = 1_500_000;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full — the server still has it */
  }
}

/** { collection: { id: { v: value|null, t: ms } } } */
const data = Object.fromEntries(COLLECTIONS.map((c) => [c, readJson(cacheKey(c), {})]));
const pending = new Set(readJson(PENDING_KEY, []));
const listeners = new Set();
let status = { state: "starting", at: 0 };
const statusListeners = new Set();

const pkey = (c, id) => `${c}\t${id}`;
const savePending = () => writeJson(PENDING_KEY, [...pending]);
const setStatus = (state) => {
  status = { state, at: Date.now() };
  statusListeners.forEach((fn) => fn(status));
};

migrateFromOldVersion();

// ---------------------------------------------------------------------------
export function getAll(c) {
  const out = {};
  for (const [id, it] of Object.entries(data[c] ?? {})) if (it.v !== null) out[id] = it.v;
  return out;
}

export function getItem(c, id) {
  const it = data[c]?.[id];
  return it && it.v !== null ? it.v : undefined;
}

/** Save (value) or delete (null). */
export function setItem(c, id, value) {
  const prev = data[c][id]?.t ?? 0;
  data[c][id] = { v: value ?? null, t: Math.max(Date.now(), prev + 1) };
  writeJson(cacheKey(c), data[c]);
  pending.add(pkey(c, id));
  savePending();
  schedulePush();
}

export const removeItem = (c, id) => setItem(c, id, null);

/** fn(Set of changed collections) after another device's changes arrive. */
export const onDataChange = (fn) => listeners.add(fn);
export const onSyncStatus = (fn) => statusListeners.add(fn);
export const syncStatus = () => ({ ...status, pending: pending.size });

// ---------------------------------------------------------------------------
let pushTimer = null;
let pushing = false;

function schedulePush(delay = 400) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, delay);
}

async function push() {
  if (pushing) return schedulePush(1000);
  if (!pending.size) return;
  pushing = true;
  try {
    const batches = [];
    let batch = [];
    let size = 0;
    for (const k of [...pending]) {
      const [c, id] = k.split("\t");
      const it = data[c]?.[id];
      if (!it) {
        pending.delete(k);
        continue;
      }
      const item = { c, id, v: it.v === null ? null : JSON.stringify(it.v), t: it.t };
      const n = (item.v?.length ?? 4) + id.length + 40;
      if (n > MAX_ITEM_CHARS) {
        console.warn(`Not syncing ${c}/${id}: too large (it stays on this device).`);
        pending.delete(k);
        continue;
      }
      if (batch.length && (size + n > MAX_BATCH_CHARS || batch.length >= 200)) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(item);
      size += n;
    }
    if (batch.length) batches.push(batch);
    for (const b of batches) {
      const r = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: b }) });
      if (r.status === 400) console.warn("Sync refused:", (await r.json().catch(() => ({}))).error);
      else if (!r.ok) throw new Error(`status ${r.status}`);
      // Done — unless the item changed again while it was being sent.
      for (const it of b) if (data[it.c]?.[it.id]?.t === it.t) pending.delete(pkey(it.c, it.id));
      savePending();
    }
    setStatus("synced");
  } catch {
    setStatus("offline"); // kept as pending; retried on the next change, when back online, or when reopened
  } finally {
    pushing = false;
  }
}

/** Fetch the server's copy and merge. Returns true if it was reached. */
export async function pull() {
  let items;
  try {
    const r = await fetch("/api/sync", { cache: "no-store" });
    if (!r.ok) throw new Error(`status ${r.status}`);
    ({ items } = await r.json());
  } catch {
    setStatus("offline");
    return false;
  }
  const changed = new Set();
  const seen = new Set();
  for (const it of items ?? []) {
    if (!COLLECTIONS.includes(it.c)) continue;
    const k = pkey(it.c, it.id);
    seen.add(k);
    const local = data[it.c][it.id];
    const same = local && (local.v === null ? it.v === null : it.v !== null && it.v === JSON.stringify(local.v));
    if (!local || it.t > local.t || (it.t === local.t && !same)) {
      data[it.c][it.id] = { v: it.v === null ? null : JSON.parse(it.v), t: it.t };
      pending.delete(k);
      changed.add(it.c);
    } else if (local.t > it.t) {
      pending.add(k);
    }
  }
  // Anything only this device has (made offline, or from before syncing existed) goes up.
  for (const c of COLLECTIONS) for (const id of Object.keys(data[c])) if (!seen.has(pkey(c, id))) pending.add(pkey(c, id));
  changed.forEach((c) => writeJson(cacheKey(c), data[c]));
  savePending();
  setStatus("synced");
  if (changed.size) listeners.forEach((fn) => fn(changed));
  if (pending.size) schedulePush(50);
  return true;
}

/** Start syncing. `onFront` also runs whenever the app comes back to the front (e.g. reload words). */
export function startSync(onFront = () => {}) {
  let last = 0;
  const refresh = () => {
    if (Date.now() - last < 3000) return;
    last = Date.now();
    pull();
    onFront();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
    else if (pending.size) push();
  });
  window.addEventListener("online", refresh);
  last = Date.now();
  return pull();
}

// ---------------------------------------------------------------------------
// Data saved by earlier versions (this browser only) becomes synced data once.
function migrateFromOldVersion() {
  try {
    if (localStorage.getItem("cih.migrated.v2") !== null) return;
    const put = (c, id, v, t) => {
      if (!data[c][id]) {
        data[c][id] = { v, t: t || 1 };
        pending.add(pkey(c, id));
      }
    };
    for (const [id, p] of Object.entries(readJson("cih.progress.v1", {}))) put("progress", id, p, p?.last);
    for (const d of readJson("cih.decks.v1", [])) if (d?.id) put("decks", d.id, d, Number(String(d.id).split("-")[1]));
    for (const s of readJson("cih.sessions.v1", [])) {
      if (s?.id) put("sessions", s.id, s, Math.max(s.createdAt ?? 0, ...(s.transcript ?? []).map((m) => m.timestamp ?? 0)));
    }
    const settings = readJson("cih.settings.v1", null);
    if (settings) put("prefs", "settings", settings, 1);
    const study = readJson("cih.study.v1", null);
    if (study) put("prefs", "study", study, 1);
    COLLECTIONS.forEach((c) => writeJson(cacheKey(c), data[c]));
    savePending();
    ["cih.progress.v1", "cih.decks.v1", "cih.sessions.v1", "cih.settings.v1", "cih.study.v1"].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("cih.migrated.v2", "1");
  } catch {
    /* storage unavailable — nothing to migrate */
  }
}
