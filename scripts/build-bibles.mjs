#!/usr/bin/env node
/**
 * Converts public-domain Bible JSON (thiagobodruk/bible format) into the compact
 * format the server loads from data/bible/<id>.json:
 *
 *   { id, name, language, credit, books: [ [ ["verse 1", "verse 2", ...], ...chapters ], ...66 books ] }
 *
 * Usage:
 *   node scripts/build-bibles.mjs <dir-with-downloaded-json>
 *
 * Download sources first (only public-domain texts are bundled):
 *   curl -LO https://raw.githubusercontent.com/thiagobodruk/bible/master/json/ko_krv.json
 *   curl -LO https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_webu.json
 *
 * ESV / NIV / 개역개정 are copyrighted and must NOT be bundled. ESV is supported
 * live through the official ESV API instead (set ESV_API_KEY).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "data", "bible");

const SOURCES = [
  {
    file: "ko_krv.json",
    id: "krv",
    name: "개역한글 (Korean Revised Version, 1961)",
    short: "개역한글",
    language: "ko",
    credit: "개역한글판 (1961) — public domain.",
  },
  {
    file: "en_webu.json",
    id: "webu",
    name: "World English Bible (Updated)",
    short: "WEB",
    language: "en",
    credit: "World English Bible — public domain.",
  },
];

function cleanVerse(text, language) {
  let t = String(text ?? "");
  if (language === "en") {
    // Strip leftover footnote fragments such as: God " (Elohim). created
    t = t.replace(/\s*"\s*\([^)]*\)\.?/g, "");
    // Remove stray spaces before punctuation: "LORD ," -> "LORD,"
    t = t.replace(/\s+([,.;:!?’”])/g, "$1");
  }
  return t.replace(/\s+/g, " ").trim();
}

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("Usage: node scripts/build-bibles.mjs <dir-with-downloaded-json>");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const src of SOURCES) {
  const inPath = path.join(srcDir, src.file);
  if (!fs.existsSync(inPath)) {
    console.warn(`skip ${src.file} (not found)`);
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(inPath, "utf8").replace(/^﻿/, ""));
  if (!Array.isArray(raw) || raw.length !== 66) {
    throw new Error(`${src.file}: expected 66 books, got ${raw?.length}`);
  }
  const books = raw.map((book) => book.chapters.map((ch) => ch.map((v) => cleanVerse(v, src.language))));
  const out = {
    id: src.id,
    name: src.name,
    short: src.short,
    language: src.language,
    credit: src.credit,
    books,
  };
  const outPath = path.join(OUT_DIR, `${src.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out));
  const verses = books.reduce((n, b) => n + b.reduce((m, c) => m + c.length, 0), 0);
  console.log(`wrote ${path.relative(process.cwd(), outPath)} (${verses} verses)`);
}
