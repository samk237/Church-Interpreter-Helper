/**
 * Server-side passage assembly from the offline Bibles (and optional ESV API text).
 */
import { formatReference, parseReferences } from "./reference.js";

export const MAX_VERSES = 200;

/**
 * Expand parsed references into concrete verse lists.
 * @param {ReturnType<typeof parseReferences>} parsed
 * @param {Array<{books: string[][][]}>|{books: string[][][]}} lengthSources Bibles used for chapter
 *        lengths — the longest wins, so versification differences (e.g. Rom 16:25-27) aren't cut off.
 */
export function expandReferences(parsed, lengthSources, { maxVerses = MAX_VERSES } = {}) {
  const sources = (Array.isArray(lengthSources) ? lengthSources : [lengthSources]).filter(Boolean);
  const chapterLength = (bookIndex, chapter) =>
    Math.max(0, ...sources.map((b) => b.books[bookIndex]?.[chapter - 1]?.length ?? 0));
  const warnings = [...(parsed?.errors ?? [])];
  const passages = [];
  let total = 0;

  for (const ref of parsed?.refs ?? []) {
    const verses = [];
    for (const s of ref.segments) {
      for (let c = s.startChapter; c <= s.endChapter; c += 1) {
        const chapterLen = chapterLength(ref.book.index, c);
        const from = c === s.startChapter && s.startVerse !== null ? s.startVerse : 1;
        let to = c === s.endChapter && s.endVerse !== null ? s.endVerse : chapterLen;
        if (from > chapterLen) {
          warnings.push(`${ref.book.en} ${c} only has ${chapterLen} verses.`);
          continue;
        }
        if (to > chapterLen) {
          warnings.push(`${ref.book.en} ${c} ends at verse ${chapterLen}.`);
          to = chapterLen;
        }
        for (let v = from; v <= to; v += 1) {
          if (total >= maxVerses) break;
          verses.push({ chapter: c, verse: v });
          total += 1;
        }
      }
    }
    if (verses.length) {
      passages.push({
        book: { index: ref.book.index, en: ref.book.en, ko: ref.book.ko },
        reference: formatReference(ref, "en"),
        referenceKo: formatReference(ref, "ko"),
        segments: ref.segments,
        verses,
      });
    }
  }
  if (total >= maxVerses) warnings.push(`Showing the first ${maxVerses} verses only.`);
  return { passages, warnings };
}

/**
 * Attach text from a bundled Bible ({books}) under the given key ("ko" / "en").
 * Verses missing in `bible` are filled from `fallback` (if given) and listed in the return value.
 */
export function attachText(passages, bible, key, fallback = null) {
  const filled = [];
  for (const p of passages) {
    const book = bible.books[p.book.index];
    for (const v of p.verses) {
      let text = book?.[v.chapter - 1]?.[v.verse - 1] ?? "";
      if (!text && fallback) {
        text = fallback.books[p.book.index]?.[v.chapter - 1]?.[v.verse - 1] ?? "";
        if (text) filled.push(`${p.book.en} ${v.chapter}:${v.verse}`);
      }
      v[key] = text;
    }
  }
  return filled;
}

/** Convenience used by the server and tests. */
export function lookupPassages(query, { korean, english, englishFallback, maxVerses } = {}) {
  const parsed = parseReferences(query);
  if (!parsed) return null;
  const { passages, warnings } = expandReferences(parsed, [english, korean], { maxVerses });
  if (korean) attachText(passages, korean, "ko");
  if (english) {
    const filled = attachText(passages, english, "en", englishFallback && englishFallback !== english ? englishFallback : null);
    if (filled.length) {
      warnings.push(`${filled.join(", ")}: not at this location in ${english.short ?? "this translation"} (versification differs) — shown from ${englishFallback.short ?? "fallback"}.`);
    }
  }
  return { passages, warnings };
}

/**
 * Align ESV API text ("[16] For God so loved... [17] For God did not...") with the expected verses.
 * Handles chapter-number markers at chapter starts ("[5] ..." for 5:1) and verses the ESV omits
 * from its main text (e.g. Matt 17:21). Returns an array of texts (undefined = omitted) or null.
 */
export function distributeEsvText(text, verses) {
  const parts = String(text ?? "").split(/\[(\d+(?::\d+)?)\]/);
  const out = new Array(verses.length);
  let i = 0;
  let matched = 0;
  let last = -1;
  for (let k = 1; k < parts.length; k += 2) {
    const marker = parts[k];
    const chunk = parts[k + 1].replace(/\s+/g, " ").replace(/\(ESV\)\s*$/, "").trim();
    const [a, b] = marker.split(":").map(Number);
    const isMatch = (v) => (b !== undefined ? v.chapter === a && v.verse === b : v.verse === a || (v.verse === 1 && v.chapter === a));
    let found = -1;
    for (let j = i; j < Math.min(verses.length, i + 6); j += 1) {
      if (isMatch(verses[j])) {
        found = j;
        break;
      }
    }
    if (found === -1) {
      if (last >= 0) out[last] = `${out[last]} ${chunk}`.trim();
      continue;
    }
    out[found] = chunk;
    matched += 1;
    last = found;
    i = found + 1;
  }
  return matched > 0 ? out : null;
}
