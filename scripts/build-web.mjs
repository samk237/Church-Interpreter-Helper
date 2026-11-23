#!/usr/bin/env node
/** Assemble dist/ for Cloudflare Pages: the app (public/), shared browser modules (lib/), and the word lists. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, "public"), dist, { recursive: true });
fs.cpSync(path.join(root, "lib"), path.join(dist, "lib"), { recursive: true });
fs.mkdirSync(path.join(dist, "data"), { recursive: true });
fs.copyFileSync(path.join(root, "data", "word-lists.js"), path.join(dist, "data", "word-lists.js"));
// Bible books rarely change: let the browser keep them; everything else revalidates.
fs.writeFileSync(
  path.join(dist, "_headers"),
  ["/bible/*", "  Cache-Control: private, max-age=604800", "/*", "  X-Content-Type-Options: nosniff", "  Referrer-Policy: same-origin", ""].join("\n")
);
console.log("built dist/");
