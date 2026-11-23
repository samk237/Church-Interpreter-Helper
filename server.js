import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { distributeEsvText, lookupPassages } from "./lib/scripture-service.js";
import { formatReference } from "./lib/reference.js";
import { BOOKS } from "./lib/bible-books.js";
import { buildTermPrompt, buildTranslatePrompt, cleanModelOutput, isShortTerm, parseTermResponse } from "./lib/mt-prompt.js";
import { buildGlossary } from "./lib/glossary.js";
import { WORD_LISTS } from "./data/word-lists.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Optional local config (ESV_API_KEY, OLLAMA_MODEL, ...). Never committed.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(__dirname, file));
  } catch {
    /* file not present */
  }
}

const PORT = Number.parseInt(process.env.PORT ?? "5173", 10);
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
// If OLLAMA_MODEL isn't set, the best Korean-capable model you have installed is used.
const OLLAMA_MODEL_PREFERENCE = [
  process.env.OLLAMA_MODEL,
  "exaone3.5:7.8b",
  "exaone3.5",
  "qwen2.5:7b",
  "qwen2.5",
  "gemma2:9b",
  "llama3",
].filter(Boolean);
// Keep the model loaded between lookups (a service is ~1-2 hours).
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE ?? "3h";
const OLLAMA_TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_TIMEOUT_MS ?? "20000", 10);
const MT_PROVIDERS = (process.env.MT_PROVIDERS ?? "ollama")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL ?? "";
const ESV_API_KEY = (process.env.ESV_API_KEY ?? "").trim();
const ESV_ENABLED = ESV_API_KEY.length > 0 && !/your_esv/i.test(ESV_API_KEY);

const DATA_DIR = path.join(__dirname, "data");
const CUSTOM_WORDS_FILE = path.join(DATA_DIR, "custom-words.json");

// ---------------------------------------------------------------------------
// Bibles (public domain, bundled) — loaded once at startup
// ---------------------------------------------------------------------------
function loadBible(id) {
  const file = path.join(DATA_DIR, "bible", `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
// krv = Korean text. webu = offline English used only when ESV is unavailable (no key / no internet).
const BIBLES = Object.fromEntries(["krv", "webu"].map((id) => [id, loadBible(id)]).filter(([, b]) => b));

const ESV_INFO = {
  id: "esv",
  short: "ESV",
  name: "English Standard Version",
  language: "en",
  credit:
    "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
};

// ---------------------------------------------------------------------------
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

// Only expose what the browser needs (NOT the project root).
app.use(express.static(path.join(__dirname, "public")));
app.use("/lib", express.static(path.join(__dirname, "lib")));
app.get("/data/word-lists.js", (_req, res) => res.sendFile(path.join(DATA_DIR, "word-lists.js")));

app.get("/api/health", async (_req, res) => {
  res.json({
    status: "ok",
    esv: ESV_ENABLED,
    offlineBibles: Object.keys(BIBLES),
    machineTranslation: MT_PROVIDERS,
    ollama: { host: OLLAMA_HOST, reachable: await ollamaReachable(), model: ollamaStatus.model, installed: ollamaStatus.installed },
  });
});

// ---------------------------------------------------------------------------
// Scripture: Korean from bundled 개역한글, English from the official ESV API
// ---------------------------------------------------------------------------
const esvCache = new Map();

app.get("/api/scripture", async (req, res) => {
  const q = String(req.query.q ?? "").slice(0, 300);
  const korean = BIBLES.krv;
  const offlineEnglish = BIBLES.webu;

  const result = lookupPassages(q, { korean, english: offlineEnglish });
  if (!result) return res.status(400).json({ error: "That doesn't look like a scripture reference." });
  if (result.passages.length === 0) {
    return res.status(404).json({ error: result.warnings.join(" ") || "Passage not found." });
  }
  // Versification notes about the offline English don't matter when ESV is used
  let warnings = result.warnings;
  let english = pick(offlineEnglish);

  if (ESV_ENABLED) {
    try {
      const esvTexts = [];
      for (const p of result.passages) esvTexts.push(await fetchEsvForPassage(p));
      const omitted = [];
      result.passages.forEach((p, i) =>
        p.verses.forEach((v, j) => {
          const t = esvTexts[i][j];
          v.en = t ?? "";
          if (t === undefined) omitted.push(`${p.book.en} ${v.chapter}:${v.verse}`);
        })
      );
      english = ESV_INFO;
      warnings = warnings.filter((w) => !/versification/.test(w));
      if (omitted.length) warnings.push(`${omitted.join(", ")}: not in the ESV main text (footnote only).`);
    } catch (error) {
      console.warn("[scripture] ESV failed, using offline WEB:", error.message);
      warnings.push(`ESV unavailable (${error.message}) — English shown from the offline WEB.`);
    }
  } else {
    warnings.push("English is from the offline WEB. Add ESV_API_KEY to .env.local for ESV.");
  }

  res.json({ passages: result.passages, warnings, korean: pick(korean), english });
});

function pick(bible) {
  if (!bible) return null;
  const { id, short, name, language, credit } = bible;
  return { id, short, name, language, credit };
}

/** Returns an array of ESV verse texts aligned to passage.verses (undefined = not in ESV main text). */
async function fetchEsvForPassage(passage) {
  const out = new Array(passage.verses.length);
  let offset = 0;
  for (const segment of passage.segments) {
    const count = countSegmentVerses(passage, offset, segment);
    const slice = passage.verses.slice(offset, offset + count);
    if (slice.length) {
      const label = formatReference({ book: BOOKS[passage.book.index], segments: [segment] }, "en");
      const texts = distributeEsvText(await fetchEsv(label), slice);
      if (!texts) throw new Error("could not read ESV verse numbers");
      texts.forEach((t, k) => (out[offset + k] = t));
    }
    offset += count;
  }
  return out;
}

function countSegmentVerses(passage, offset, segment) {
  let n = 0;
  for (let i = offset; i < passage.verses.length; i += 1) {
    const v = passage.verses[i];
    const afterStart = v.chapter > segment.startChapter || (v.chapter === segment.startChapter && (segment.startVerse === null || v.verse >= segment.startVerse));
    const beforeEnd = v.chapter < segment.endChapter || (v.chapter === segment.endChapter && (segment.endVerse === null || v.verse <= segment.endVerse));
    if (afterStart && beforeEnd) n += 1;
    else break;
  }
  return n;
}

async function fetchEsv(reference) {
  if (esvCache.has(reference)) return esvCache.get(reference);
  const params = new URLSearchParams({
    q: reference,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-copyright": "false",
    "include-selahs": "true",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
    "line-length": "0",
  });
  const response = await fetchWithTimeout(`https://api.esv.org/v3/passage/text/?${params}`, {
    headers: { Authorization: `Token ${ESV_API_KEY}` },
    timeout: 8000,
  });
  if (!response.ok) throw new Error(`ESV API status ${response.status}`);
  const payload = await response.json();
  const text = (payload.passages ?? []).join(" ");
  if (!text.trim()) throw new Error("ESV returned no text");
  esvCache.set(reference, text);
  if (esvCache.size > 300) esvCache.delete(esvCache.keys().next().value);
  return text;
}

// ---------------------------------------------------------------------------
// Machine translation (fallback for words NOT in your lists — always labelled)
// ---------------------------------------------------------------------------
app.post("/api/translate", async (req, res) => {
  const { text, sourceLang, hints, autosave } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || !["ko", "en"].includes(sourceLang)) {
    return res.status(400).json({ error: "`text` and `sourceLang` (ko|en) are required." });
  }
  const clean = text.trim().slice(0, 2000);
  const targetLang = sourceLang === "ko" ? "en" : "ko";
  const glossaryHints = Array.isArray(hints)
    ? hints
        .filter((h) => h && typeof h.ko === "string" && typeof h.en === "string")
        .slice(0, 40)
        .map((h) => ({ ko: h.ko.slice(0, 80), en: h.en.slice(0, 160) }))
    : [];

  const errors = [];
  for (const provider of MT_PROVIDERS) {
    try {
      let out = null;
      if (provider === "ollama") out = await translateWithOllama(clean, sourceLang, targetLang, glossaryHints);
      else if (provider === "libretranslate" && LIBRETRANSLATE_URL) {
        const t = await translateWithLibre(clean, sourceLang, targetLang);
        out = t ? { translation: t, corrected: null } : null;
      }
      if (!out) continue;
      const label = providerLabel(provider);
      const response = { translatedText: out.translation, provider: label, corrected: out.corrected, saved: null, glossaryHit: null };

      // AI spelling fix points at a word you already have => use YOUR entry, save nothing.
      if (out.corrected && getServerGlossary().get(out.corrected)) {
        response.glossaryHit = getServerGlossary().get(out.corrected).ko;
      } else if (autosave && isShortTerm(clean)) {
        response.saved = saveAiWord({ typed: clean, sourceLang, ...out, provider: label });
      }
      return res.json(response);
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }
  res.status(502).json({ error: "No machine translation available.", detail: errors.join("; ") });
});

function providerLabel(p) {
  if (p === "ollama") return `Ollama (${ollamaStatus.model})`;
  if (p === "libretranslate") return "LibreTranslate";
  return p;
}

let ollamaStatus = { ok: null, checkedAt: 0, model: null, installed: [] };
async function ollamaReachable() {
  if (/^disabled$/i.test(OLLAMA_HOST)) return false;
  if (Date.now() - ollamaStatus.checkedAt < 60_000 && ollamaStatus.ok !== null) return ollamaStatus.ok;
  try {
    const r = await fetchWithTimeout(`${OLLAMA_HOST}/api/tags`, { timeout: 800 });
    const installed = r.ok ? ((await r.json()).models ?? []).map((m) => m.name) : [];
    const model = pickOllamaModel(installed);
    ollamaStatus = { ok: r.ok && Boolean(model), checkedAt: Date.now(), model, installed };
  } catch {
    ollamaStatus = { ok: false, checkedAt: Date.now(), model: null, installed: [] };
  }
  return ollamaStatus.ok;
}

function pickOllamaModel(installed) {
  for (const want of OLLAMA_MODEL_PREFERENCE) {
    const hit = installed.find((name) => name === want || name === `${want}:latest` || name.startsWith(`${want}:`));
    if (hit) return hit;
  }
  return installed[0] ?? null;
}

async function translateWithOllama(text, sourceLang, targetLang, hints) {
  if (!(await ollamaReachable())) throw new Error("not running");
  // English single terms: JSON reply so the model can also fix spelling (reliable for English).
  // Korean single terms: plain short prompt (more accurate; Korean "did you mean" comes from your glossary).
  const useJson = sourceLang === "en" && isShortTerm(text);
  const r = await fetchWithTimeout(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaStatus.model,
      prompt: useJson ? buildTermPrompt(text, sourceLang) : buildTranslatePrompt(text, sourceLang, hints),
      ...(useJson ? { format: "json" } : {}),
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: { temperature: 0, seed: 7, num_predict: isShortTerm(text) ? 60 : 512 },
    }),
    timeout: OLLAMA_TIMEOUT_MS,
  });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const raw = (await r.json())?.response;
  if (useJson) {
    const parsed = parseTermResponse(raw, text, sourceLang);
    if (parsed) return parsed;
  }
  const out = cleanModelOutput(raw);
  if (!out) throw new Error("empty response");
  return { translation: out, corrected: null };
}

/** Load the model into memory ahead of time so the first lookup in a service is fast. */
async function warmUpOllama() {
  if (!MT_PROVIDERS.includes("ollama") || !(await ollamaReachable())) return;
  try {
    await fetchWithTimeout(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaStatus.model, keep_alive: OLLAMA_KEEP_ALIVE }),
      timeout: 60000,
    });
    console.log(`  Ollama model ready: ${ollamaStatus.model}`);
  } catch (error) {
    console.warn(`  Ollama warm-up failed: ${error.message}`);
  }
}

async function translateWithLibre(text, sourceLang, targetLang) {
  const r = await fetchWithTimeout(LIBRETRANSLATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: "text" }),
    timeout: 10000,
  });
  if (!r.ok) throw new Error(`status ${r.status}`);
  const payload = await r.json();
  return String(payload?.translatedText ?? "").trim() || null;
}

async function fetchWithTimeout(url, { timeout = 8000, ...opts } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("timed out");
    throw error;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Custom words you add from the app -> data/custom-words.json (durable, git-trackable)
// ---------------------------------------------------------------------------
function readCustomWords() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CUSTOM_WORDS_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomWords(words) {
  const tmp = `${CUSTOM_WORDS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(words, null, 2) + "\n");
  fs.renameSync(tmp, CUSTOM_WORDS_FILE);
  serverGlossary = null; // rebuild on next use
}

// The server knows your glossary too, so AI words are never saved over words you already have.
let serverGlossary = null;
function getServerGlossary() {
  if (!serverGlossary) serverGlossary = buildGlossary(WORD_LISTS, readCustomWords());
  return serverGlossary;
}

/** Save an AI answer for a single term as an UNREVIEWED word (status "ai") for later review in the Glossary. */
function saveAiWord({ typed, sourceLang, translation, corrected, provider }) {
  const source = corrected ?? typed;
  const ko = sourceLang === "ko" ? source : translation.split(" / ")[0].trim();
  const en = sourceLang === "ko" ? translation : source;
  if (!ko || !en || getServerGlossary().get(ko)) return null;
  const words = readCustomWords();
  if (words.some((w) => w.ko === ko)) return null;
  const word = {
    ko: ko.slice(0, 80),
    en: en.slice(0, 200),
    note: sourceLang === "en" ? `AI (${provider}) from English “${source}”: ${translation}` : `AI (${provider})`,
    ...(sourceLang === "ko" && corrected ? { alt: [typed] } : {}),
    status: "ai",
    addedAt: new Date().toISOString(),
  };
  words.push(word);
  writeCustomWords(words);
  return word;
}

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

app.get("/api/custom-words", (_req, res) => res.json({ words: readCustomWords() }));

app.post("/api/custom-words", (req, res) => {
  const ko = clip(req.body?.ko, 80);
  const en = clip(req.body?.en, 200);
  const note = clip(req.body?.note, 300);
  const status = req.body?.status === "ai" ? "ai" : "confirmed";
  const alt = Array.isArray(req.body?.alt) ? req.body.alt.map((a) => clip(a, 80)).filter(Boolean).slice(0, 5) : undefined;
  const replaces = clip(req.body?.replaces, 80); // editing a word's Korean spelling
  if (!ko || !en) return res.status(400).json({ error: "Both Korean and English are required." });
  let words = readCustomWords();
  if (replaces && replaces !== ko) words = words.filter((w) => w.ko !== replaces);
  const existing = words.find((w) => w.ko === ko);
  const now = new Date().toISOString();
  if (existing) {
    Object.assign(existing, { en, note, status, updatedAt: now });
    if (alt) existing.alt = alt;
    if (status === "confirmed") existing.reviewedAt = now;
  } else {
    words.push({ ko, en, note, ...(alt?.length ? { alt } : {}), status, addedAt: now, ...(status === "confirmed" ? { reviewedAt: now } : {}) });
  }
  writeCustomWords(words);
  res.json({ words });
});

app.delete("/api/custom-words", (req, res) => {
  const ko = clip(req.query.ko, 80);
  const words = readCustomWords().filter((w) => w.ko !== ko);
  writeCustomWords(words);
  res.json({ words });
});

// ---------------------------------------------------------------------------
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Church Interpreter Helper → http://localhost:${PORT}`);
  console.log(`  English: ${ESV_ENABLED ? "ESV (api.esv.org)" : "offline WEB — add ESV_API_KEY to .env.local for ESV"} · Korean: 개역한글 (offline)`);
  console.log(`  Machine translation fallback: ${MT_PROVIDERS.join(" → ")}`);
  warmUpOllama();
});
