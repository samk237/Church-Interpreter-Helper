#!/usr/bin/env node
/**
 * npm run sync — merge this Mac's data (data/my-data.json) with the website's (Cloudflare), both ways:
 * words, AI words waiting for review, flashcard progress, saved decks, sessions and settings.
 * For every item the newest change wins, so it is safe to run any time, as often as you like.
 *
 *   npm run sync               merge
 *   npm run sync -- --dry-run  only show what would change
 *
 * Uses your Cloudflare sign-in from `npm run web:setup` (wrangler) and the database id in wrangler.toml.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planSync } from "../server/core/user-data.js";
import { createFileStore } from "../server/file-store.js";
import { createD1Store } from "../server/web/d1-store.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.cloudflare.com/client/v4";
const LABELS = { words: "words", progress: "flashcard results", decks: "saved decks", sessions: "sessions", prefs: "settings" };

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function wranglerToken() {
  const bin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  const r = spawnSync(bin, ["auth", "token", "--json"], { cwd: root, encoding: "utf8" });
  try {
    const out = r.stdout ?? "";
    return JSON.parse(out.slice(out.indexOf("{"))).token;
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

async function findAccount(token, databaseId) {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const r = await fetch(`${API}/accounts?per_page=50`, { headers: { Authorization: `Bearer ${token}` } });
  const accounts = (await r.json().catch(() => ({}))).result ?? [];
  for (const a of accounts) {
    const db = await fetch(`${API}/accounts/${a.id}/d1/database/${databaseId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (db.ok) return a.id;
  }
  return null;
}

const describe = (items) => {
  const counts = {};
  for (const it of items) counts[it.c] = (counts[it.c] ?? 0) + 1;
  return Object.entries(counts)
    .map(([c, n]) => `${n} ${LABELS[c] ?? c}`)
    .join(", ");
};

export async function runSync({ dryRun = false, dataFile = process.env.DATA_FILE ?? path.join(root, "data", "my-data.json") } = {}) {
  const toml = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");
  const databaseId = toml.match(/database_id = "([0-9a-f-]{36})"/)?.[1];
  if (!databaseId) fail("The website isn't set up yet. Run: npm run web:setup");

  const token = wranglerToken();
  if (!token) fail("Not signed in to Cloudflare. Run: npx wrangler login   (then npm run sync again)");
  const accountId = await findAccount(token, databaseId);
  if (!accountId) fail("Couldn't find your website's database in this Cloudflare account. Run: npx wrangler login");

  const local = createFileStore(dataFile, { legacyWordsFile: path.join(root, "data", "custom-words.json") });
  const remote = createD1Store(d1OverRest({ accountId, databaseId, token }));

  console.log("Comparing this Mac with your website…");
  const [mine, theirs] = await Promise.all([local.list(), remote.list()]);
  const { toA: toMac, toB: toWeb } = planSync(mine, theirs);

  if (!toMac.length && !toWeb.length) {
    console.log(`✓ Already in sync (${mine.length} items on both).`);
    return { toMac: 0, toWeb: 0 };
  }
  if (toMac.length) console.log(`  ↓ website → Mac: ${describe(toMac)}`);
  if (toWeb.length) console.log(`  ↑ Mac → website: ${describe(toWeb)}`);
  if (dryRun) {
    console.log("(dry run — nothing changed)");
    return { toMac: toMac.length, toWeb: toWeb.length };
  }
  await local.put(toMac);
  await remote.put(toWeb);
  console.log("✓ Synced. Refresh the app (or switch back to it) to see the changes.");
  return { toMac: toMac.length, toWeb: toWeb.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSync({ dryRun: process.argv.includes("--dry-run") }).catch((error) => fail(error.message));
}
