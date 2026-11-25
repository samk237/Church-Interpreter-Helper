#!/usr/bin/env node
/**
 * npm run sync — merge this Mac's data (data/my-data.json) with the website's (Cloudflare), both ways:
 * words, AI words waiting for review, flashcard progress, saved decks, sessions and settings.
 * For every item the newest change wins, so it is safe to run any time, as often as you like.
 * (Mac mode does this by itself while it runs; this is for merging without starting the app.)
 *
 *   npm run sync               merge
 *   npm run sync -- --dry-run  only show what would change (changes nothing)
 *
 * Uses your Cloudflare sign-in from `npm run web:setup` (wrangler) and the database id in wrangler.toml.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFileStore } from "../server/file-store.js";
import { connectWebsite, describeItems, mergeStores } from "../server/website-link.js";

export { d1OverRest } from "../server/website-link.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function runSync({ dryRun = false, dataFile = process.env.DATA_FILE ?? path.join(root, "data", "my-data.json") } = {}) {
  const remote = await connectWebsite(root, { readOnly: dryRun });
  const local = createFileStore(dataFile, { legacyWordsFile: dryRun ? null : path.join(root, "data", "custom-words.json") });

  console.log("Comparing this Mac with your website…");
  const { toMac, toWeb, total } = await mergeStores(local, remote, { dryRun });
  if (!toMac.length && !toWeb.length) {
    console.log(`✓ Already in sync (${total} items on both).`);
    return { toMac: 0, toWeb: 0 };
  }
  if (toMac.length) console.log(`  ↓ website → Mac: ${describeItems(toMac)}`);
  if (toWeb.length) console.log(`  ↑ Mac → website: ${describeItems(toWeb)}`);
  console.log(dryRun ? "(dry run — nothing changed)" : "✓ Synced. Refresh the app (or switch back to it) to see the changes.");
  return { toMac: toMac.length, toWeb: toWeb.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSync({ dryRun: process.argv.includes("--dry-run") }).catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
  });
}
