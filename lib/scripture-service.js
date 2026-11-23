/**
 * Passage assembly — runs in the browser (and in tests). Bible text is loaded per book,
 * chapter lengths come from the small VERSE_COUNTS table, and ESV text (fetched by the server
 * so the API key stays secret) is aligned verse-by-verse.
 */
import { formatReference, parseReferences } from "./reference.js";
import { VERSE_COUNTS } from "./verse-counts.js";

export const MAX_VERSES = 200;

const defaultChapterLength = (bookIndex, chapter) => VERSE_COUNTS[bookIndex]?.[chapter - 1] ?? 0;

/**
 * Expand parsed references into concrete verse lists.
 * Each verse is { chapter, verse, seg } where seg is the index of its segment within the passage.
 */
export function expandReferences(parsed, { maxVerses = MAX_VERSES, chapterLength = defaultChapterLength } = {}) {
  const warnings = [...(parsed?.errors ?? [])];
  const passages = [];
  let total = 0;

  for (const ref of parsed?.refs ?? []) {
    const verses = [];
    ref.segments.forEach((s, seg) => {
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
          verses.push({ chapter: c, verse: v, seg });
          total += 1;
        }
      }
    });
    if (verses.length) {
      passages.push({
        book: { index: ref.book.index, en: ref.book.en, ko: ref.book.ko },
        reference: formatReference(ref, "en"),
        referenceKo: formatReference(ref, "ko"),
        segments: ref.segments,
        segmentLabels: ref.segments.map((s) => formatReference({ book: ref.book, segments: [s] }, "en")),
        verses,
      });
    }
  }
  if (total >= maxVerses) warnings.push(`Showing the first ${maxVerses} verses only.`);
  return { passages, warnings };
}

/**
 * Attach text under `key` ("ko" / "en"). getBook(index) returns that book's chapters
 * ([["v1","v2"...], ...]) or undefined. Verses missing there are taken from getFallback (if given)
 * and returned so the caller can say so.
 */
export function attachText(passages, getBook, key, getFallback = null) {
  const filled = [];
  for (const p of passages) {
    const book = getBook(p.book.index);
    for (const v of p.verses) {
      let text = book?.[v.chapter - 1]?.[v.verse - 1] ?? "";
      if (!text && getFallback) {
        text = getFallback(p.book.index)?.[v.chapter - 1]?.[v.verse - 1] ?? "";
        if (text) filled.push(`${p.book.en} ${v.chapter}:${v.verse}`);
      }
      v[key] = text;
    }
  }
  return filled;
}

/** Convenience for tests / scripts with whole Bibles in memory: { books: [...66] }. */
export function lookupPassages(query, { korean, english, maxVerses } = {}) {
  const parsed = parseReferences(query);
  if (!parsed) return null;
  const { passages, warnings } = expandReferences(parsed, { maxVerses });
  if (korean) attachText(passages, (i) => korean.books[i], "ko");
  if (english) attachText(passages, (i) => english.books[i], "en");
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

/**
 * Put ESV segment texts (one per passage segment, in passage/segment order) onto the verses.
 * Returns { ok, omitted: ["Matthew 17:21", ...] }; when !ok nothing is changed.
 */
export function applyEsvTexts(passages, texts) {
  const staged = [];
  const omitted = [];
  let t = 0;
  for (const p of passages) {
    for (let seg = 0; seg < p.segments.length; seg += 1) {
      const verses = p.verses.filter((v) => v.seg === seg);
      const text = texts[t++];
      if (!verses.length) continue;
      const aligned = distributeEsvText(text, verses);
      if (!aligned) return { ok: false, omitted: [] };
      verses.forEach((v, k) => {
        staged.push([v, aligned[k] ?? ""]);
        if (aligned[k] === undefined) omitted.push(`${p.book.en} ${v.chapter}:${v.verse}`);
      });
    }
  }
  staged.forEach(([v, text]) => (v.en = text));
  return { ok: true, omitted };
}
