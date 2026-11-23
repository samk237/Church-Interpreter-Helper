/**
 * Scripture lookup in the browser: parse the reference, load only the needed books
 * (public/bible/<translation>/<book>.json, cached), and get ESV text from the server.
 * Works the same on the Mac server and on the website.
 */
import { parseReferences } from "/lib/reference.js";
import { applyEsvTexts, attachText, expandReferences } from "/lib/scripture-service.js";

const books = new Map(); // "krv/42" -> chapters
const metas = new Map();

async function loadJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't load ${url} (${r.status})`);
  return r.json();
}

async function loadBooks(translation, indexes) {
  await Promise.all(
    indexes.map(async (i) => {
      const key = `${translation}/${i}`;
      if (!books.has(key)) books.set(key, await loadJson(`/bible/${translation}/${i}.json`));
    })
  );
  return (i) => books.get(`${translation}/${i}`);
}

async function loadMeta(translation) {
  if (!metas.has(translation)) metas.set(translation, await loadJson(`/bible/${translation}/meta.json`));
  return metas.get(translation);
}

/** Returns { passages, warnings, korean, english } (same shape the UI renders). */
export async function lookupScripture(query) {
  const parsed = parseReferences(query);
  if (!parsed) throw new Error("That doesn't look like a scripture reference.");
  const { passages, warnings } = expandReferences(parsed);
  if (!passages.length) throw new Error(warnings.join(" ") || "Passage not found.");
  const indexes = [...new Set(passages.map((p) => p.book.index))];

  const [getKorean, korean] = await Promise.all([loadBooks("krv", indexes), loadMeta("krv")]);
  attachText(passages, getKorean, "ko");

  // English: ESV from the server (key stays there); offline WEB if ESV isn't available.
  let english = null;
  const labels = passages.flatMap((p) => p.segmentLabels);
  try {
    const r = await fetch(`/api/esv?refs=${encodeURIComponent(JSON.stringify(labels))}`);
    const payload = await r.json().catch(() => ({}));
    if (r.status === 501) {
      warnings.push("English is from the offline WEB — ESV isn't set up yet.");
    } else if (!r.ok) {
      throw new Error(payload.error ?? `status ${r.status}`);
    } else {
      const { ok, omitted } = applyEsvTexts(passages, payload.texts ?? []);
      if (!ok) throw new Error("couldn't line up ESV verses");
      english = payload.info;
      if (omitted.length) warnings.push(`${omitted.join(", ")}: not in the ESV main text (footnote only).`);
    }
  } catch (error) {
    warnings.push(`ESV unavailable (${error.message}) — English shown from the offline WEB.`);
  }
  if (!english) {
    const [getWeb, web] = await Promise.all([loadBooks("webu", indexes), loadMeta("webu")]);
    attachText(passages, getWeb, "en");
    english = web;
  }
  return { passages, warnings, korean, english };
}
