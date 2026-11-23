import { WORD_LISTS, SCRIPTURE_LISTS } from "/data/word-lists.js";
import { buildGlossary } from "/lib/glossary.js";
import { lookupScripture } from "./scripture.js";

// ---------- safe localStorage ----------
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — ignore */
  }
}

// ---------- settings ----------
const SETTINGS_KEY = "cih.settings.v1";
export const settings = {
  verseLang: "both",
  autoMt: true,
  ...load(SETTINGS_KEY, {}),
};
export function saveSettings() {
  save(SETTINGS_KEY, settings);
}

// ---------- glossary (word lists + custom words) ----------
let customWords = [];
let glossary = buildGlossary(WORD_LISTS, customWords);
const listeners = new Set();

export const wordLists = WORD_LISTS;
export const scriptureLists = SCRIPTURE_LISTS;
export const getGlossary = () => glossary;
export const getCustomWords = () => customWords;
export function onGlossaryChange(fn) {
  listeners.add(fn);
}

function rebuild(words) {
  customWords = words;
  glossary = buildGlossary(WORD_LISTS, customWords);
  listeners.forEach((fn) => fn(glossary));
}

export async function loadCustomWords() {
  try {
    const r = await fetch("/api/custom-words");
    if (r.ok) rebuild((await r.json()).words ?? []);
  } catch {
    /* server offline — lists still work */
  }
}

/** Save / update a word. status "confirmed" (default) or "ai"; `replaces` = old Korean spelling when editing. */
export async function addCustomWord({ ko, en, note, alt, status = "confirmed", replaces }) {
  const r = await fetch("/api/custom-words", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ko, en, note, alt, status, replaces }),
  });
  const payload = await r.json();
  if (!r.ok) throw new Error(payload.error ?? "Could not save");
  rebuild(payload.words);
}

/** Mark an AI-suggested word as reviewed and correct (keeps it permanently). */
export async function confirmAiWord(ko) {
  const w = customWords.find((x) => x.ko === ko);
  if (w) await addCustomWord({ ...w, status: "confirmed" });
}

export const aiReviewCount = () => customWords.filter((w) => w.status === "ai").length;

export async function deleteCustomWord(ko) {
  const r = await fetch(`/api/custom-words?ko=${encodeURIComponent(ko)}`, { method: "DELETE" });
  if (r.ok) rebuild((await r.json()).words);
}

/** Short badge label for a list id: "wl5" -> "#5", "core" -> "core" */
export function listBadge(id) {
  const m = id.match(/^wl(\d+)(b?)$/);
  if (m) return `#${m[1]}${m[2]}`;
  if (id === "custom") return "mine";
  if (id === "ai") return "AI · unreviewed";
  if (id === "thanksgiving") return "feasts";
  return id;
}

// ---------- API helpers ----------
export async function fetchScripture(q) {
  return lookupScripture(q);
}

export async function machineTranslate(text, sourceLang, hints = []) {
  const r = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLang, hints }),
  });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(payload.error ?? "AI unavailable");
  return payload;
}
