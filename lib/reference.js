/**
 * Scripture reference parser (deterministic, no network).
 *
 * Accepts things interpreters actually type:
 *   "Jn 3:16"  "John 3:16-18"  "Mt 16:16 -20"  "1Jn 3:8"  "I John 3:8"
 *   "Rom 8:1-2, 28"  "Rom 8:28, 9:1-3"  "Eph 6:10-18; Jas 4:7"
 *   "롬 10:17"  "요한복음 3장 16절"  "요 3장 16-18절"  "시편 23편"  "마 5:3~12"
 *   "Matthew 4:23-5:2" (cross-chapter)   "Jude 3" (single-chapter book)
 *   "Romans 8" (whole chapter)
 */
import { findBook } from "./bible-books.js";

/** Normalise punctuation and Korean chapter/verse words into "C:V-V" form. */
export function normalizeReferenceText(raw) {
  let s = String(raw ?? "")
    .normalize("NFKC")
    .replace(/[–—−~〜]/g, "-")
    .replace(/[：]/g, ":")
    .replace(/[，、]/g, ",")
    .replace(/[；]/g, ";");
  // Korean: "3장 16절" / "3장 16-18절" / "3장16절-18절" / "23편"
  s = s.replace(/(\d+)\s*(?:장|편)\s*(\d+)/g, "$1:$2");
  s = s.replace(/(\d+)\s*절/g, "$1");
  s = s.replace(/(\d+)\s*(?:장|편)/g, "$1");
  // English helpers: "chapter 3 verse 16", "v. 16", "vv 16-18"
  s = s.replace(/\bch(?:apter|\.)?\s*(\d+)\s*(?:verses?|vv?\.?)\s*(\d+)/gi, "$1:$2");
  s = s.replace(/(\d)\s*\.\s*(\d)/g, "$1:$2"); // "John 3.16"
  // Collapse spaces around separators: "16 -20" -> "16-20", "3 : 16" -> "3:16"
  s = s.replace(/\s*([:\-])\s*/g, "$1");
  s = s.replace(/\s*,\s*/g, ", ");
  return s.trim();
}

// book part: optional number prefix, then letters (Latin or Hangul), possibly multi-word ("Song of Songs")
const BOOK_THEN_NUMBERS = /^((?:[1-3]|i{1,3}|1st|2nd|3rd|first|second|third)?\s*[a-zㄱ-힣][a-zㄱ-힣.]*(?:\s+(?:of\s+)?[a-zㄱ-힣]+)*)\s*(\d[\d:,\-\s]*)$/i;

/**
 * Parse a string containing one or more references.
 * @returns {{ refs: Array<Ref>, errors: string[] } | null}  null when the text doesn't look like references at all.
 *
 * Ref = { book, segments: [{ startChapter, startVerse|null, endChapter, endVerse|null }] }
 */
export function parseReferences(raw) {
  const text = normalizeReferenceText(raw);
  if (!text) return null;
  const parts = text
    .split(/\s*(?:;|\n|\band\b|그리고)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const refs = [];
  const errors = [];
  let lastBook = null;

  for (const part of parts) {
    let book = null;
    let numbers = null;
    const m = part.match(BOOK_THEN_NUMBERS);
    if (m) {
      book = findBook(m[1]);
      numbers = m[2];
      if (!book) {
        // "Song of Songs" style names: try the longest prefix that is a book
        const words = m[1].split(/\s+/);
        for (let n = words.length - 1; n > 0 && !book; n -= 1) {
          book = findBook(words.slice(0, n).join(" "));
        }
        if (!book) return null; // unknown book word => this isn't a reference query
      }
    } else if (lastBook && /^\d[\d:,\-\s]*$/.test(part)) {
      // "John 3:16; 4:1" — reuse the previous book
      book = lastBook;
      numbers = part;
    } else {
      return null;
    }

    const segments = parseNumbers(numbers, book, errors);
    if (segments.length === 0) {
      errors.push(`Could not read the chapter/verse in "${part}".`);
      continue;
    }
    refs.push({ book, segments });
    lastBook = book;
  }

  if (refs.length === 0 && errors.length === 0) return null;
  return { refs, errors };
}

function parseNumbers(numbers, book, errors) {
  const items = numbers
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const segments = [];
  let currentChapter = null;
  const singleChapter = book.chapters === 1;

  for (const item of items) {
    let m;
    if ((m = item.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) {
      // 4:23-5:2
      segments.push(seg(+m[1], +m[2], +m[3], +m[4]));
      currentChapter = +m[3];
    } else if ((m = item.match(/^(\d+):(\d+)(?:-(\d+))?$/))) {
      // 3:16 or 3:16-18
      const c = +m[1];
      segments.push(seg(c, +m[2], c, m[3] ? +m[3] : +m[2]));
      currentChapter = c;
    } else if ((m = item.match(/^(\d+)(?:-(\d+))?$/))) {
      const a = +m[1];
      const b = m[2] ? +m[2] : null;
      if (singleChapter) {
        // Jude 3, Jude 3-5
        segments.push(seg(1, a, 1, b ?? a));
        currentChapter = 1;
      } else if (currentChapter !== null) {
        // ", 28" after "8:1-2" => verse in the same chapter
        segments.push(seg(currentChapter, a, currentChapter, b ?? a));
      } else {
        // whole chapter(s): "Romans 8" / "Psalms 1-2"
        segments.push(seg(a, null, b ?? a, null));
      }
    } else {
      errors.push(`Could not read "${item}".`);
    }
  }
  return segments.filter((s) => {
    if (s.startChapter < 1 || s.startChapter > book.chapters || s.endChapter > book.chapters) {
      errors.push(`${book.en} only has ${book.chapters} chapter${book.chapters === 1 ? "" : "s"}.`);
      return false;
    }
    if (s.endChapter < s.startChapter || (s.endChapter === s.startChapter && s.endVerse !== null && s.endVerse < s.startVerse)) {
      errors.push(`Backwards range in ${book.en}.`);
      return false;
    }
    return true;
  });
}

function seg(startChapter, startVerse, endChapter, endVerse) {
  return { startChapter, startVerse, endChapter, endVerse };
}

/** Human-readable label, e.g. "Romans 8:1-2, 28" / "로마서 8:1-2, 28". */
export function formatReference(ref, language = "en") {
  const name = language === "ko" ? ref.book.ko : ref.book.en;
  let prevChapter = null;
  const pieces = ref.segments.map((s) => {
    let out;
    if (s.startVerse === null) {
      out = s.endChapter !== s.startChapter ? `${s.startChapter}-${s.endChapter}` : `${s.startChapter}`;
    } else if (s.endChapter !== s.startChapter) {
      out = `${s.startChapter}:${s.startVerse}-${s.endChapter}:${s.endVerse}`;
    } else {
      const verses = s.endVerse !== s.startVerse ? `${s.startVerse}-${s.endVerse}` : `${s.startVerse}`;
      out = prevChapter === s.startChapter ? verses : `${s.startChapter}:${verses}`;
    }
    prevChapter = s.endChapter;
    return out;
  });
  if (ref.book.chapters === 1) {
    // "Jude 3" rather than "Jude 1:3"
    return `${name} ${pieces.map((p) => p.replace(/^1:/, "")).join(", ")}`;
  }
  return `${name} ${pieces.join(", ")}`;
}

/**
 * True when the whole input is written as scripture reference(s) — including invalid ones
 * like "Acts 99:1", so they get a clear error instead of being treated as a word.
 */
export function looksLikeReference(raw) {
  const parsed = parseReferences(raw);
  return Boolean(parsed && (parsed.refs.length > 0 || parsed.errors.length > 0));
}
