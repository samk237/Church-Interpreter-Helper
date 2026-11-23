#!/usr/bin/env node
/**
 * One-time setup of the website (Cloudflare Pages, free plan):
 *   1. sign in to Cloudflare (browser)          4. set secrets: password, ESV key, Gemini key
 *   2. create the D1 database + tables          5. copy your added words from data/custom-words.json
 *   3. create the Pages project                 6. build + deploy → prints your URL
 * Safe to run again (skips what already exists; secrets you leave blank are kept).
 *
 *   npm run web:setup
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "interpreter-helper";
const DB_NAME = "interpreter-helper";
const TOML = path.join(root, "wrangler.toml");

const wrangler = (args, { input, capture = false } = {}) =>
  spawnSync("npx", ["wrangler", ...args], {
    cwd: root,
    input,
    encoding: "utf8",
    stdio: capture || input !== undefined ? ["pipe", "pipe", "pipe"] : "inherit",
  });

function fail(message, result) {
  console.error(`\n✘ ${message}`);
  if (result?.stderr) console.error(result.stderr.trim().split("\n").slice(-5).join("\n"));
  process.exit(1);
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = () => {}; // don't echo secrets
    rl.question("", (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function localEnv(name) {
  try {
    const m = fs.readFileSync(path.join(root, ".env.local"), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    const v = (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
    return v && !/your_|_here$/i.test(v) ? v : "";
  } catch {
    return "";
  }
}

console.log("Interpreter Helper — website setup (Cloudflare Pages, free)\n");

// 1. Sign in
const who = wrangler(["whoami"], { capture: true });
if (who.status !== 0 || /not authenticated|not logged in/i.test(`${who.stdout}${who.stderr}`)) {
  console.log("Step 1: sign in to Cloudflare (a browser window opens; create a free account if you don't have one).");
  if (wrangler(["login"]).status !== 0) fail("Cloudflare sign-in failed.");
} else {
  console.log("Step 1: already signed in to Cloudflare ✓");
}

// 2. Database
console.log("\nStep 2: database for your added words");
let dbs = JSON.parse(wrangler(["d1", "list", "--json"], { capture: true }).stdout || "[]");
let db = dbs.find((d) => d.name === DB_NAME);
if (!db) {
  const created = wrangler(["d1", "create", DB_NAME], { capture: true });
  if (created.status !== 0) fail("Couldn't create the database.", created);
  dbs = JSON.parse(wrangler(["d1", "list", "--json"], { capture: true }).stdout || "[]");
  db = dbs.find((d) => d.name === DB_NAME);
}
if (!db?.uuid) fail("Couldn't find the database id.");
fs.writeFileSync(TOML, fs.readFileSync(TOML, "utf8").replace(/database_id = "[^"]*"/, `database_id = "${db.uuid}"`));
const schema = wrangler(["d1", "execute", DB_NAME, "--remote", "--file", "server/schema.sql", "-y"], { capture: true });
if (schema.status !== 0) fail("Couldn't create the tables.", schema);
console.log(`  database ${DB_NAME} ready ✓`);

// 3. Pages project
console.log("\nStep 3: website project");
const projects = wrangler(["pages", "project", "list"], { capture: true }).stdout ?? "";
if (!projects.includes(PROJECT)) {
  const created = wrangler(["pages", "project", "create", PROJECT, "--production-branch", "main"], { capture: true });
  if (created.status !== 0 && !/already exists/i.test(created.stderr ?? "")) fail("Couldn't create the Pages project.", created);
}
console.log(`  project ${PROJECT} ready ✓`);

// 4. Secrets
console.log("\nStep 4: secrets (stored encrypted on Cloudflare; leave blank to keep the current value)");
const putSecret = (name, value) => {
  const r = wrangler(["pages", "secret", "put", name, "--project-name", PROJECT], { input: `${value}\n` });
  if (r.status !== 0) fail(`Couldn't save ${name}.`, r);
  console.log(`  ${name} saved ✓`);
};
let password = await ask("  Website password (12+ characters; you'll type it once per device): ", { hidden: true });
while (password && password.length < 12) password = await ask("  Please use at least 12 characters: ", { hidden: true });
if (password) putSecret("APP_PASSWORD", password);

const esvLocal = localEnv("ESV_API_KEY");
const esv = esvLocal && (await ask("  Use the ESV key from .env.local? [Y/n] ")).toLowerCase() !== "n" ? esvLocal : await ask("  ESV API key (blank = skip): ", { hidden: true });
if (esv) putSecret("ESV_API_KEY", esv);

const geminiLocal = localEnv("GEMINI_API_KEY");
const gemini = geminiLocal && (await ask("  Use the Gemini key from .env.local? [Y/n] ")).toLowerCase() !== "n" ? geminiLocal : await ask("  Gemini API key from aistudio.google.com/apikey (blank = skip): ", { hidden: true });
if (gemini) putSecret("GEMINI_API_KEY", gemini);

// 5. Copy words added on the Mac
console.log("\nStep 5: words you added on the Mac");
let words = [];
try {
  words = JSON.parse(fs.readFileSync(path.join(root, "data", "custom-words.json"), "utf8"));
} catch {
  /* none */
}
if (Array.isArray(words) && words.length) {
  const answer = (await ask(`  Copy ${words.length} word(s) from data/custom-words.json to the website (replaces the website's list)? [y/N] `)).toLowerCase();
  if (answer === "y") {
    const sql = `INSERT INTO store (key, value, updated_at) VALUES ('custom-words', '${JSON.stringify(words).replace(/'/g, "''")}', '${new Date().toISOString()}') ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`;
    const tmp = path.join(root, ".wrangler-import.sql");
    fs.writeFileSync(tmp, sql);
    const r = wrangler(["d1", "execute", DB_NAME, "--remote", "--file", tmp, "-y"], { capture: true });
    fs.rmSync(tmp, { force: true });
    if (r.status !== 0) fail("Couldn't copy the words.", r);
    console.log("  copied ✓");
  }
} else {
  console.log("  none to copy");
}

// 6. Deploy
console.log("\nStep 6: publishing the website…");
spawnSync("node", ["scripts/build-web.mjs"], { cwd: root, stdio: "inherit" });
const deploy = wrangler(["pages", "deploy", "--project-name", PROJECT, "--branch", "main", "--commit-dirty=true"], { capture: true });
process.stdout.write(deploy.stdout ?? "");
if (deploy.status !== 0) fail("Deploy failed.", deploy);
// The site lives at <project>.pages.dev (Cloudflare adds a suffix if that name was taken).
const listing = wrangler(["pages", "project", "list"], { capture: true }).stdout ?? "";
const domain = listing.match(new RegExp(`${PROJECT}[\\w-]*\\.pages\\.dev`))?.[0] ?? `${PROJECT}.pages.dev`;
console.log(`\n✓ Done. Open https://${domain} on your phone, sign in once, then Share → Add to Home Screen.`);
console.log("  Later updates: npm run web:deploy");
