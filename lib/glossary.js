/**
 * Deterministic glossary engine.
 *
 * - Merges every word list (plus words you add in the app) into one entry per Korean headword,
 *   keeping ALL meanings and which list each came from (nothing silently overwritten).
 * - Exact lookup ignores spacing ("하늘 나라" == "하늘나라") and accepts known alternate spellings.
 * - Sentence scanning finds glossary words inside running Korean text even with particles
 *   attached (은혜를, 중보기도를) or conjugated (시기했다, 애통하며).
 * - Fuzzy suggestions compare letter-by-letter (jamo), so 맹새 finds 맹세 and 수면재 finds 수면제.
 * - English -> Korean reverse lookup over every meaning.
 *
 * Same input + same word lists => same output, always. No AI involved.
 */
import {
  compactKorean,
  conjugationForms,
  containsHangul,
  editDistance,
  isChoseongOnly,
  PARTICLES,
  stripParticle,
  toChoseong,
  toJamo,
} from "./korean.js";

const PARTICLE_SET = new Set(PARTICLES);

// 1-syllable words that are far too common to flag inside sentences (한 = "one/a", 의 = "of"...).
// They still work as exact lookups.
const NO_SCAN = new Set(["한", "의", "영", "억", "죄", "틱", "굿"]);

/** Normalise one English meaning into lookup phrases: "to be WORN OUT (tired)" -> ["worn out"] */
export function englishPhrases(en) {
  return String(en ?? "")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*(?:\/|,|;|\bor\b|=|·|—|–|\s-\s)\s*/i)
    .map((p) =>
      p
        .toLowerCase()
        .replace(/[!?.“”"']/g, "")
        .replace(/^(?:to be|to|be|the|a|an)\s+/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((p) => p.length > 1);
}

function englishStem(word) {
  const w = word.toLowerCase();
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ied")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function stemPhrase(phrase) {
  return phrase.split(" ").map(englishStem).join(" ");
}

/**
 * @param {Array<{id, title, entries: Array<[ko, en, opts?]>}>} wordLists
 * @param {Array<{ko, en, note?}>} customWords  words added from the app
 */
export function buildGlossary(wordLists, customWords = []) {
  const byKey = new Map(); // compact headword -> entry
  const altKey = new Map(); // compact alt spelling -> entry
  const listTitles = new Map();

  const ingest = (listId, ko, en, opts = {}) => {
    if (!ko || !en) return;
    const key = compactKorean(ko);
    if (!key) return;
    let entry = byKey.get(key) ?? altKey.get(key);
    if (!entry) {
      entry = { id: key, ko: ko.trim(), alts: [], senses: [], lists: [], star: false, custom: false, noScan: false };
      byKey.set(key, entry);
    }
    for (const alt of opts.alt ?? []) {
      const ak = compactKorean(alt);
      if (ak && ak !== entry.id && !entry.alts.includes(alt)) {
        entry.alts.push(alt);
        if (!byKey.has(ak)) altKey.set(ak, entry);
      }
    }
    const enTrim = String(en).trim();
    const dup = entry.senses.find((s) => s.en.toLowerCase() === enTrim.toLowerCase());
    if (dup) {
      if (opts.note && !dup.note) dup.note = opts.note;
      if (!dup.lists.includes(listId)) dup.lists.push(listId);
    } else {
      entry.senses.push({ en: enTrim, note: opts.note ?? "", lists: [listId] });
    }
    if (!entry.lists.includes(listId)) entry.lists.push(listId);
    if (opts.star) entry.star = true;
    if (opts.noScan) entry.noScan = true;
    if (listId === "custom") entry.custom = true;
  };

  for (const list of wordLists) {
    listTitles.set(list.id, list.title);
    for (const [ko, en, opts] of list.entries) ingest(list.id, ko, en, opts);
  }
  listTitles.set("custom", "My added words");
  for (const w of customWords) ingest("custom", w.ko, w.en, { note: w.note, alt: w.alt, star: w.star });

  const entries = [...byKey.values()];
  entries.forEach((e) => {
    e.en = [...new Set(e.senses.map((s) => s.en))].join(" · ");
    e.choseong = toChoseong(e.ko);
    e.jamo = toJamo(e.id);
  });

  // ---- Korean scan forms -------------------------------------------------
  const formsByFirst = new Map();
  const addForm = (form, entry, hasSpace, kind) => {
    if (!form) return;
    const list = formsByFirst.get(form[0]) ?? [];
    if (list.some((f) => f.form === form && f.entry === entry)) return;
    list.push({ form, entry, hasSpace, kind });
    formsByFirst.set(form[0], list);
  };
  for (const e of entries) {
    const spellings = [e.ko, ...e.alts];
    for (const s of spellings) {
      const c = compactKorean(s);
      addForm(c, e, /\s/.test(s.trim()), "word");
      for (const f of conjugationForms(s)) addForm(f, e, /\s/.test(s.trim()), "conj");
    }
  }
  for (const list of formsByFirst.values()) list.sort((a, b) => b.form.length - a.form.length);

  // ---- English index -----------------------------------------------------
  const enIndex = new Map(); // phrase or stemmed phrase -> Set(entry)
  const addEn = (phrase, entry) => {
    for (const k of new Set([phrase, stemPhrase(phrase)])) {
      const set = enIndex.get(k) ?? new Set();
      set.add(entry);
      enIndex.set(k, set);
    }
  };
  for (const e of entries) for (const s of e.senses) for (const p of englishPhrases(s.en)) addEn(p, e);
  const enPhrases = [...enIndex.keys()];

  // ---- API ---------------------------------------------------------------
  function get(ko) {
    const key = compactKorean(ko);
    return byKey.get(key) ?? altKey.get(key) ?? null;
  }

  /** Find glossary words inside Korean text. Returns matches in text order. */
  function scan(text) {
    const src = String(text ?? "").normalize("NFC");
    // Build compact char list with mapping back to the original string.
    const chars = [];
    const origIndex = [];
    const wordStart = [];
    const wordId = [];
    let w = 0;
    let prevWasSpace = true;
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (/[\s.,!?·~\-_'"“”‘’()[\]{}<>/\\|:;]/.test(ch)) {
        if (!prevWasSpace) w += 1;
        prevWasSpace = true;
        continue;
      }
      chars.push(ch.toLowerCase());
      origIndex.push(i);
      wordStart.push(prevWasSpace);
      wordId.push(w);
      prevWasSpace = false;
    }
    const compact = chars.join("");
    const matches = [];
    let i = 0;
    while (i < chars.length) {
      const candidates = formsByFirst.get(chars[i]);
      let matched = null;
      if (candidates) {
        for (const cand of candidates) {
          const len = cand.form.length;
          if (!compact.startsWith(cand.form, i)) continue;
          const endIdx = i + len - 1;
          const crossesSpace = wordId[endIdx] !== wordId[i];
          if (crossesSpace && !cand.hasSpace) continue;
          if (len === 1) {
            if (cand.entry.noScan || NO_SCAN.has(cand.form) || !wordStart[i]) continue;
            // rest of the word must be empty or a particle
            let rest = "";
            for (let k = i + 1; k < chars.length && wordId[k] === wordId[i]; k += 1) rest += chars[k];
            if (rest && !PARTICLE_SET.has(rest)) continue;
          } else if (len === 2 && !wordStart[i]) {
            continue;
          }
          matched = cand;
          break;
        }
      }
      if (matched) {
        const len = matched.form.length;
        const start = origIndex[i];
        const end = origIndex[i + len - 1] + 1;
        matches.push({ entry: matched.entry, start, end, text: src.slice(start, end), kind: matched.kind });
        i += len;
      } else {
        i += 1;
      }
    }
    return matches;
  }

  /** English text -> glossary entries (greedy longest phrase, up to 5 words). */
  function scanEnglish(text) {
    const words = String(text ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9'\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const found = [];
    let i = 0;
    while (i < words.length) {
      let hit = null;
      for (let n = Math.min(5, words.length - i); n >= 1 && !hit; n -= 1) {
        const phrase = words.slice(i, i + n).join(" ");
        const set = enIndex.get(phrase) ?? enIndex.get(stemPhrase(phrase));
        if (set && (n > 1 || phrase.length > 2)) hit = { phrase, entries: [...set], n };
      }
      if (hit) {
        found.push(hit);
        i += hit.n;
      } else {
        i += 1;
      }
    }
    return found;
  }

  /** Close spellings of a Korean or English query. */
  function suggest(query, limit = 8, exclude = new Set(), { strict = false } = {}) {
    const q = String(query ?? "").trim();
    if (!q) return [];
    if (containsHangul(q)) {
      if (isChoseongOnly(q)) {
        const cq = q.replace(/\s/g, "");
        return entries.filter((e) => e.choseong.startsWith(cq) && !exclude.has(e)).slice(0, limit);
      }
      const variants = [...new Set([compactKorean(q), compactKorean(stripParticle(compactKorean(q)))])].map((v) => ({
        v,
        jamo: toJamo(v),
      }));
      const maxD = Math.max(1, Math.round(variants[0].jamo.length * 0.3));
      const scored = [];
      for (const e of entries) {
        if (exclude.has(e)) continue;
        let best = Infinity;
        for (const { v, jamo } of variants) {
          for (const s of [e.id, ...e.alts.map(compactKorean)]) {
            const d = editDistance(jamo, s === e.id ? e.jamo : toJamo(s));
            const contains = v.length >= 2 && s.length >= 2 && (s.includes(v) || v.includes(s));
            const score = contains ? Math.min(d, 1.5) : d;
            if (score < best) best = score;
          }
        }
        if (best <= maxD) scored.push({ e, best });
      }
      return scored
        .sort((a, b) => a.best - b.best || a.e.id.length - b.e.id.length)
        .slice(0, limit)
        .map((s) => s.e);
    }
    const nq = q.toLowerCase();
    const sq = stemPhrase(nq);
    const scored = [];
    for (const p of enPhrases) {
      let score;
      if (p.startsWith(nq) || p.startsWith(sq)) score = 0.5;
      else if (new RegExp(`\\b${escapeRe(sq)}`).test(p)) score = 1;
      else if (strict) continue;
      else {
        const d = editDistance(nq, p);
        if (d > Math.max(1, Math.floor(nq.length * 0.3))) continue;
        score = 1 + d;
      }
      for (const e of enIndex.get(p)) if (!exclude.has(e)) scored.push({ e, score });
    }
    const seen = new Set();
    return scored
      .sort((a, b) => a.score - b.score || a.e.en.length - b.e.en.length)
      .filter((s) => (seen.has(s.e) ? false : seen.add(s.e)))
      .slice(0, limit)
      .map((s) => s.e);
  }

  /**
   * Main lookup used by the interpreter view.
   * @returns {{ language, exact: Entry[], found: Match[], suggestions: Entry[] }}
   */
  function lookup(query) {
    const q = String(query ?? "").trim();
    const language = containsHangul(q) ? "ko" : "en";
    if (!q) return { language, exact: [], found: [], suggestions: [] };

    if (language === "ko") {
      const exact = [];
      const direct = get(q) ?? get(stripParticle(compactKorean(q)));
      if (direct) exact.push(direct);
      let found = [];
      if (!direct) {
        found = scan(q);
        // Single word typed with an ending we didn't anticipate: try conjugation forms directly
        if (found.length === 0 && !/\s/.test(q)) {
          const c = compactKorean(q);
          for (let cut = c.length - 1; cut >= 2 && found.length === 0; cut -= 1) {
            const prefix = c.slice(0, cut);
            const list = formsByFirst.get(prefix[0]) ?? [];
            const hit = list.find((f) => f.form === prefix && f.form.length >= 2);
            if (hit) found = [{ entry: hit.entry, start: 0, end: cut, text: q.slice(0, cut), kind: "prefix" }];
          }
        }
      }
      const foundEntries = new Set([...exact, ...found.map((m) => m.entry)]);
      const isSentence = /\s/.test(q) && q.length > 8;
      const suggestions = exact.length || (isSentence && found.length) ? [] : suggest(q, 8, foundEntries);
      return { language, exact, found, suggestions };
    }

    const nq = q.toLowerCase().replace(/^(?:to be|to|be|the|a|an)\s+/, "").trim();
    const exactSet = enIndex.get(nq) ?? enIndex.get(stemPhrase(nq));
    const exact = exactSet ? [...exactSet] : [];
    const found = [];
    if (exact.length === 0 && /\s/.test(nq)) {
      for (const hit of scanEnglish(q)) for (const e of hit.entries) found.push({ entry: e, text: hit.phrase });
    }
    const already = new Set([...exact, ...found.map((f) => f.entry)]);
    const suggestions = exact.length ? suggest(q, 4, already, { strict: true }) : suggest(q, 8, already);
    return { language, exact, found, suggestions };
  }

  /** Instant results while typing (prefix first, then fuzzy). */
  function autocomplete(prefix, limit = 6) {
    const q = String(prefix ?? "").trim();
    if (!q) return [];
    if (containsHangul(q)) {
      if (isChoseongOnly(q)) return suggest(q, limit);
      const c = compactKorean(q);
      const starts = entries.filter((e) => e.id.startsWith(c) || e.alts.some((a) => compactKorean(a).startsWith(c)));
      starts.sort((a, b) => a.id.length - b.id.length);
      if (starts.length) return starts.slice(0, limit);
      // nothing starts this way: maybe a misspelling, a particle, or a conjugation
      const hit = lookup(q);
      return [...hit.exact, ...hit.found.map((m) => m.entry), ...hit.suggestions].filter((e, i, a) => a.indexOf(e) === i).slice(0, limit);
    }
    if (q.length < 2) return [];
    return suggest(q, limit);
  }

  /** Free-text filter for the glossary browser. */
  function search(query, { list = "all", starredOnly = false } = {}) {
    const q = String(query ?? "").trim().toLowerCase();
    const cq = compactKorean(q);
    return entries.filter((e) => {
      if (list !== "all" && !e.lists.includes(list)) return false;
      if (starredOnly && !e.star) return false;
      if (!q) return true;
      if (cq && (e.id.includes(cq) || e.alts.some((a) => compactKorean(a).includes(cq)))) return true;
      if (isChoseongOnly(q) && e.choseong.startsWith(cq)) return true;
      return e.senses.some((s) => s.en.toLowerCase().includes(q) || s.note.toLowerCase().includes(q));
    });
  }

  return {
    entries,
    listTitles,
    get,
    lookup,
    scan,
    scanEnglish,
    suggest,
    autocomplete,
    search,
    size: entries.length,
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
