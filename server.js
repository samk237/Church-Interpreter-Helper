/**
 * Mac server (`npm start` / `npm run phone`). The same frontend also runs as a website on
 * Cloudflare Pages (see functions/ and README → "Website"); both share server/core/*.
 */
import express from "express";
import fs from "node:fs";
import http from "node:http";
import QRCode from "qrcode";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPhoneGate, formatCode, isLoopback, lanAddresses, loadOrCreateCode } from "./server/phone-access.js";
import { claudeProvider, DEFAULT_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL, geminiProvider, parseTranslateRequest, translateWithProviders } from "./server/core/ai.js";
import { ESV_INFO, esvKeyUsable, fetchEsvTexts, parseEsvRefs } from "./server/core/esv.js";
import { removeWord, upsertWord } from "./server/core/custom-words.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Optional local config (ESV_API_KEY, GEMINI_API_KEY, OLLAMA_MODEL, ...). Never committed.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(__dirname, file));
  } catch {
    /* file not present */
  }
}

const PORT = Number.parseInt(process.env.PORT ?? "5173", 10);
// Phone mode (`npm run phone`): reachable from other devices on the same Wi-Fi, protected by an access code.
// Default (`npm start`): only this Mac can open it.
const PHONE_MODE = process.argv.includes("--phone") || /^(1|true|yes)$/i.test(process.env.PHONE ?? "");
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
// If OLLAMA_MODEL isn't set, the best Korean-capable model you have installed is used.
const OLLAMA_MODEL_PREFERENCE = [process.env.OLLAMA_MODEL, "exaone3.5:7.8b", "exaone3.5", "qwen2.5:7b", "qwen2.5", "gemma2:9b", "llama3"].filter(Boolean);
// Keep the model loaded between lookups (a service is ~1-2 hours).
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE ?? "3h";
const OLLAMA_TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_TIMEOUT_MS ?? "20000", 10);
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY ?? "").trim();
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY ?? "").trim();
// AI order: cloud first when keys are set (better Korean), then the local model.
const AI_PROVIDERS = (process.env.AI_PROVIDERS ?? process.env.MT_PROVIDERS ?? "gemini,claude,ollama")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter((p) => (p === "gemini" ? GEMINI_API_KEY : p === "claude" ? ANTHROPIC_API_KEY : p === "ollama"));
const ESV_API_KEY = (process.env.ESV_API_KEY ?? "").trim();
const ESV_ENABLED = esvKeyUsable(ESV_API_KEY);

const DATA_DIR = path.join(__dirname, "data");
// Override with CUSTOM_WORDS_FILE=/path/file.json (used by tests / isolated runs).
const CUSTOM_WORDS_FILE = process.env.CUSTOM_WORDS_FILE ?? path.join(DATA_DIR, "custom-words.json");

// ---------------------------------------------------------------------------
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

const PHONE_CODE = PHONE_MODE ? loadOrCreateCode(path.join(__dirname, ".phone-code")) : null;
if (PHONE_MODE) {
  const gate = createPhoneGate({ code: PHONE_CODE, publicPaths: ["/icons/", "/manifest.webmanifest", "/favicon.ico"] });
  app.post("/unlock", express.urlencoded({ extended: false, limit: "2kb" }), gate.unlockHandler);
  app.use(gate.middleware);
}

app.get("/favicon.ico", (_req, res) => res.sendFile(path.join(__dirname, "public", "icons", "icon-192.png")));

// Home-screen app manifest. When an unlocked phone adds it to the home screen, the start URL
// carries the access code so the installed app can unlock itself (it has its own cookie jar).
app.get("/manifest.webmanifest", (req, res) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "public", "manifest.webmanifest"), "utf8"));
  if (PHONE_MODE && req.cihAuthed) manifest.start_url = `/?key=${PHONE_CODE}`;
  res.type("application/manifest+json").send(JSON.stringify(manifest));
});

// Only expose what the browser needs (NOT the project root).
app.use(express.static(path.join(__dirname, "public")));
app.use("/lib", express.static(path.join(__dirname, "lib")));
app.get("/data/word-lists.js", (_req, res) => res.sendFile(path.join(DATA_DIR, "word-lists.js")));

app.get("/api/health", async (_req, res) => {
  const providers = await activeProviders();
  res.json({
    status: "ok",
    mode: PHONE_MODE ? "mac-phone" : "mac",
    esv: ESV_ENABLED,
    ai: { available: providers.length > 0, label: providers.map((p) => p.label).join(" → ") || null },
  });
});

// Phone pairing info (QR code + access code) — only for the Mac itself.
app.get("/api/phone", async (req, res) => {
  if (!isLoopback(req)) return res.status(403).json({ error: "Only available on the Mac running the helper." });
  if (!PHONE_MODE) return res.json({ enabled: false });
  const urls = lanAddresses().map((ip) => `http://${ip}:${PORT}/?key=${PHONE_CODE}`);
  const qrSvg = urls[0] ? await QRCode.toString(urls[0], { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : "";
  res.json({ enabled: true, code: formatCode(PHONE_CODE), urls, qrSvg });
});

// ---------------------------------------------------------------------------
// ESV text (the browser assembles passages; the key stays here)
// ---------------------------------------------------------------------------
const esvCache = new Map();
app.get("/api/esv", async (req, res) => {
  if (!ESV_ENABLED) return res.status(501).json({ error: "ESV is not set up (add ESV_API_KEY to .env.local)." });
  const refs = parseEsvRefs(req.query.refs);
  if (!refs) return res.status(400).json({ error: "Bad reference list." });
  try {
    res.json({ texts: await fetchEsvTexts(refs, { apiKey: ESV_API_KEY, cache: esvCache }), info: ESV_INFO });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// AI fallback for words NOT in your lists — always labelled in the app
// ---------------------------------------------------------------------------
app.post("/api/translate", async (req, res) => {
  const request = parseTranslateRequest(req.body);
  if (request.error) return res.status(400).json({ error: request.error });
  try {
    res.json(await translateWithProviders(await activeProviders(), request));
  } catch (error) {
    res.status(502).json({ error: error.message, detail: error.detail });
  }
});

async function activeProviders() {
  const list = [];
  for (const id of AI_PROVIDERS) {
    if (id === "gemini") list.push(geminiProvider({ apiKey: GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL }));
    if (id === "claude") list.push(getClaude());
    if (id === "ollama" && (await ollamaReachable())) list.push(ollamaProvider);
  }
  return list;
}

let claude = null;
function getClaude() {
  claude ??= claudeProvider({ apiKey: ANTHROPIC_API_KEY, model: process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL });
  return claude;
}

/** Friendly model name for labels ("EXAONE 3.5" rather than "exaone3.5:7.8b"). */
function modelDisplayName(model) {
  const m = String(model ?? "");
  if (/^exaone3\.5/.test(m)) return "EXAONE 3.5";
  if (/^qwen2\.5/.test(m)) return "Qwen 2.5";
  if (/^gemma2/.test(m)) return "Gemma 2";
  if (/^llama3/.test(m)) return "Llama 3";
  return m.replace(/:latest$/, "") || "local AI";
}

let ollamaStatus = { ok: null, checkedAt: 0, model: null };
async function ollamaReachable() {
  if (/^disabled$/i.test(OLLAMA_HOST)) return false;
  if (Date.now() - ollamaStatus.checkedAt < 60_000 && ollamaStatus.ok !== null) return ollamaStatus.ok;
  try {
    const r = await fetchWithTimeout(`${OLLAMA_HOST}/api/tags`, { timeout: 800 });
    const installed = r.ok ? ((await r.json()).models ?? []).map((m) => m.name) : [];
    const model = pickOllamaModel(installed);
    ollamaStatus = { ok: r.ok && Boolean(model), checkedAt: Date.now(), model };
  } catch {
    ollamaStatus = { ok: false, checkedAt: Date.now(), model: null };
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

/** Local model on this Mac (not "strong": no Korean did-you-mean — it guessed wrong too often). */
const ollamaProvider = {
  id: "ollama",
  get label() {
    return `${modelDisplayName(ollamaStatus.model)} (on this Mac)`;
  },
  strong: false,
  async complete(prompt, { json = false, maxTokens = 512 } = {}) {
    const r = await fetchWithTimeout(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaStatus.model,
        prompt,
        ...(json ? { format: "json" } : {}),
        stream: false,
        keep_alive: OLLAMA_KEEP_ALIVE,
        // JSON mode can pad with whitespace up to the limit, so keep it tight.
        options: { temperature: 0, seed: 7, num_predict: json ? Math.min(maxTokens, 120) : Math.min(maxTokens, 512) },
      }),
      timeout: OLLAMA_TIMEOUT_MS,
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return String((await r.json())?.response ?? "");
  },
};

/** Load the local model into memory ahead of time so the first lookup in a service is fast. */
async function warmUpOllama() {
  if (!AI_PROVIDERS.includes("ollama") || !(await ollamaReachable())) return;
  try {
    await fetchWithTimeout(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaStatus.model, keep_alive: OLLAMA_KEEP_ALIVE }),
      timeout: 60000,
    });
    console.log(`  Local AI ready: ${ollamaStatus.model}`);
  } catch (error) {
    console.warn(`  Local AI warm-up failed: ${error.message}`);
  }
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
// Words you add (and AI suggestions to review) -> data/custom-words.json
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
}

app.get("/api/custom-words", (_req, res) => res.json({ words: readCustomWords() }));

app.post("/api/custom-words", (req, res) => {
  const result = upsertWord(readCustomWords(), req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  if (result.changed) writeCustomWords(result.words);
  res.json({ words: result.words });
});

app.delete("/api/custom-words", (req, res) => {
  const words = removeWord(readCustomWords(), req.query.ko);
  writeCustomWords(words);
  res.json({ words });
});

// ---------------------------------------------------------------------------
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ---------------------------------------------------------------------------
// Start: localhost only by default; all interfaces (behind the access code) in phone mode.
function listen(host, extra = {}) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.once("error", (error) => {
      if (host === "::1") return resolve(null); // no IPv6 loopback — fine
      if (error.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use — is the helper already running? (or set PORT=...)`);
      else console.error(error);
      process.exit(1);
    });
    server.listen({ port: PORT, host, ...extra }, () => resolve(server));
  });
}

if (PHONE_MODE || process.env.HOST) {
  await listen(process.env.HOST); // undefined = all interfaces
} else {
  await listen("127.0.0.1");
  await listen("::1", { ipv6Only: true });
}

console.log(`Church Interpreter Helper → http://localhost:${PORT}`);
console.log(`  English: ${ESV_ENABLED ? "ESV (api.esv.org)" : "offline WEB — add ESV_API_KEY to .env.local for ESV"} · Korean: 개역한글 (offline)`);
console.log(`  AI for new words: ${AI_PROVIDERS.join(" → ") || "none"}`);
if (PHONE_MODE) {
  const urls = lanAddresses().map((ip) => `http://${ip}:${PORT}/?key=${PHONE_CODE}`);
  console.log("\n📱 Phone mode — on the same Wi-Fi, scan this or open a link below:");
  if (urls[0]) console.log(await QRCode.toString(urls[0], { type: "terminal", small: true }));
  urls.forEach((u) => console.log(`   ${u}`));
  console.log(`   Access code: ${formatCode(PHONE_CODE)}   (also shown in the app's ⚙ settings on this Mac)`);
  if (!urls.length) console.log("   No Wi-Fi/LAN address found — connect this Mac to the same network as your phone.");
} else {
  console.log("  Only this Mac can open it. Use `npm run phone` to open it on your phone (same Wi-Fi).");
}
warmUpOllama();
