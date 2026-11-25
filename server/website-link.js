/**
 * Connects this Mac to your website's database (Cloudflare D1) and merges data both ways:
 * words, AI words waiting for review, flashcard progress, decks, sessions and settings.
 * For every item the newest change wins, and deletions stick, so merging is safe any time.
 *
 * Uses your Cloudflare sign-in from `npm run web:setup` / `npx wrangler login` (no password needed)
 * and the database id in wrangler.toml. Used by `npm run sync` and by Mac mode's automatic syncing.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { planSync } from "./core/user-data.js";
import { createD1Store } from "./web/d1-store.js";

const API = "https://api.cloudflare.com/client/v4";
const LABELS = { words: ["word", "words"], progress: ["flashcard result", "flashcard results"], decks: ["saved deck", "saved decks"], sessions: ["session", "sessions"], prefs: ["setting", "settings"] };

/** An error whose message is written for the user. */
export class LinkError extends Error {}

export function websiteDatabaseId(root) {
  try {
    return fs.readFileSync(path.join(root, "wrangler.toml"), "utf8").match(/database_id = "([0-9a-f-]{36})"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Your Cloudflare sign-in token from wrangler (refreshed by wrangler when it expires). Never printed. */
async function wranglerToken(root) {
  const bin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  try {
    const { stdout } = await promisify(execFile)(bin, ["auth", "token", "--json"], { cwd: root, timeout: 30_000, shell: process.platform === "win32" });
    return JSON.parse(stdout.slice(stdout.indexOf("{"))).token ?? null;
  } catch {
    return null;
  }
}

/** A tiny D1-shaped client over Cloudflare's REST API (so the website's own storage code can be reused). */
export function d1OverRest({ accountId, databaseId, token, fetchImpl = fetch }) {
  async function query(sql, params) {
    const r = await fetchImpl(`${API}/accounts/${accountId}/d1/database/${databaseId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(`Cloudflare database: ${j.errors?.[0]?.message ?? `status ${r.status}`}`);
    return j.result?.[0] ?? { results: [] };
  }
  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    first: async () => (await query(sql, params)).results?.[0] ?? null,
    all: async () => ({ results: (await query(sql, params)).results ?? [] }),
    run: () => query(sql, params),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (stmts) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  };
}

async function findAccount(token, databaseId, fetchImpl) {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const opts = { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) };
  const accounts = (await (await fetchImpl(`${API}/accounts?per_page=50`, opts)).json().catch(() => ({}))).result ?? [];
  for (const a of accounts) {
    if ((await fetchImpl(`${API}/accounts/${a.id}/d1/database/${databaseId}`, opts)).ok) return a.id;
  }
  return null;
}

/** Open the website's database as a store ({ list, put }). Throws LinkError (for the user) or a network error. */
export async function connectWebsite(root, { readOnly = false, fetchImpl = fetch } = {}) {
  const databaseId = websiteDatabaseId(root);
  if (!databaseId) throw new LinkError("The website isn't set up yet. Run: npm run web:setup");
  const token = await wranglerToken(root);
  if (!token) throw new LinkError("Not signed in to Cloudflare, or offline. To sign in, run: npx wrangler login");
  const accountId = await findAccount(token, databaseId, fetchImpl);
  if (!accountId) throw new LinkError("Couldn't find your website's database in this Cloudflare account. Run: npx wrangler login");
  return createD1Store(d1OverRest({ accountId, databaseId, token, fetchImpl }), { readOnly });
}

/** Merge two stores both ways. Returns { toMac, toWeb } (the items each side received, or would receive on a dry run). */
export async function mergeStores(local, remote, { dryRun = false } = {}) {
  const [mine, theirs] = await Promise.all([local.list(), remote.list()]);
  const { toA: toMac, toB: toWeb } = planSync(mine, theirs);
  if (!dryRun) {
    if (toMac.length) await local.put(toMac);
    if (toWeb.length) await remote.put(toWeb);
  }
  return { toMac, toWeb, total: mine.length };
}

/** "2 words, 1 session" */
export function describeItems(items) {
  const counts = {};
  for (const it of items) counts[it.c] = (counts[it.c] ?? 0) + 1;
  const order = Object.keys(LABELS);
  return Object.entries(counts)
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([c, n]) => `${n} ${LABELS[c]?.[n === 1 ? 0 : 1] ?? c}`)
    .join(", ");
}

const isNetworkError = (e) => /fetch failed|network|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|timed? ?out|abort/i.test(`${e?.message} ${e?.cause?.code ?? ""} ${e?.name}`);

/**
 * Mac mode: keep this Mac's data merged with the website automatically.
 *   - start(): once when the server starts
 *   - fresh(): before answering the app's requests for data (at most every `minGapMs`, waiting `waitMs` at most)
 *   - changed(): shortly after something is saved on this Mac
 * If the website can't be reached, the Mac keeps working from its own copy and catches up later.
 */
export function createWebsiteLink({ local, connect, log = console.log, minGapMs = 15_000, waitMs = 3_000, pushDelayMs = 2_000, reconnectMs = 30 * 60_000, now = Date.now }) {
  let remote = null;
  let connectedAt = 0;
  let running = null;
  let last = 0;
  let problem = "";
  let status = { state: "starting", at: 0, message: "" };
  let pushTimer = null;

  async function syncOnce() {
    try {
      // Sign-in tokens expire, so reconnect now and then.
      if (!remote || now() - connectedAt > reconnectMs) {
        remote = await connect();
        connectedAt = now();
      }
      const { toMac, toWeb } = await mergeStores(local, remote);
      status = { state: "synced", at: now(), message: "" };
      if (problem) log("  ✓ Syncing with the website works again.");
      problem = "";
      const moved = [toMac.length && `↓ ${describeItems(toMac)} from the website`, toWeb.length && `↑ ${describeItems(toWeb)} to the website`].filter(Boolean);
      if (moved.length) log(`  ↕ Synced: ${moved.join(", ")}`);
    } catch (error) {
      remote = null;
      const message = error instanceof LinkError ? error.message : isNetworkError(error) ? "Can't reach the website right now (offline?)." : error.message;
      status = { state: "paused", at: now(), message };
      if (message !== problem) log(`  ⚠ Website sync paused: ${message} Your data is safe on this Mac and will be merged when it can.`);
      problem = message;
    } finally {
      last = now();
    }
  }

  function syncNow() {
    running ??= syncOnce().finally(() => (running = null));
    return running;
  }

  return {
    status: () => ({ ...status }),
    start: () => syncNow(),
    async fresh() {
      if (!running && now() - last < minGapMs) return;
      let timer;
      await Promise.race([syncNow(), new Promise((r) => (timer = setTimeout(r, waitMs)))]);
      clearTimeout(timer);
    },
    changed() {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(async () => {
        await running; // a merge already under way may have missed this change
        syncNow();
      }, pushDelayMs);
      pushTimer.unref?.();
    },
  };
}
