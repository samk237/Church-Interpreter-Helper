import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { lookupPassages, distributeEsvText, applyEsvTexts, expandReferences } from "../lib/scripture-service.js";
import { VERSE_COUNTS } from "../lib/verse-counts.js";
import { parseReferences } from "../lib/reference.js";
import { SCRIPTURE_LISTS, WORD_LISTS } from "../data/word-lists.js";

const bibleDir = path.join(__dirname, "..", "public", "bible");
const load = (id) => ({ ...JSON.parse(fs.readFileSync(path.join(bibleDir, id, "meta.json"), "utf8")), books: Array.from({ length: 66 }, (_, i) => JSON.parse(fs.readFileSync(path.join(bibleDir, id, `${i}.json`), "utf8"))) });
const korean = load("krv");
const english = load("webu");

describe("offline Bible data", () => {
  it("has full Bibles", () => {
    expect(korean.books).toHaveLength(66);
    expect(english.books).toHaveLength(66);
    expect(english.books[42][2][15]).toMatch(/For God so loved the world/);
    expect(korean.books[42][2][15]).toMatch(/하나님이 세상을 이처럼 사랑하사/);
  });
  it("has no leftover footnote artifacts", () => {
    expect(english.books[0][0][0]).toBe("In the beginning, God created the heavens and the earth.");
  });
});

describe("lookupPassages", () => {
  it("returns side-by-side verses", () => {
    const r = lookupPassages("요 3:16-18", { korean, english });
    expect(r.passages[0].reference).toBe("John 3:16-18");
    expect(r.passages[0].verses).toHaveLength(3);
    expect(r.passages[0].verses[0]).toMatchObject({ chapter: 3, verse: 16 });
    expect(r.passages[0].verses[0].ko).toMatch(/독생자/);
  });
  it("handles multiple passages and verse lists", () => {
    const r = lookupPassages("Rom 8:1-2, 28; Jas 4:7", { korean, english });
    expect(r.passages.map((p) => p.verses.length)).toEqual([3, 1]);
  });
  it("crosses chapters", () => {
    const r = lookupPassages("Matthew 4:24-5:2", { korean, english });
    expect(r.passages[0].verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual(["4:24", "4:25", "5:1", "5:2"]);
  });
  it("clamps verse ranges past the end of a chapter", () => {
    const r = lookupPassages("Jude 24-30", { korean, english });
    expect(r.passages[0].verses.at(-1).verse).toBe(25);
    expect(r.warnings.join(" ")).toMatch(/ends at verse 25/);
  });
  it("keeps verses the WEB numbers differently (Rom 16:25-27 comes from ESV in the app)", () => {
    const r = lookupPassages("Rom 16:25-27", { korean, english });
    expect(r.passages[0].verses).toHaveLength(3);
    expect(r.passages[0].verses[0].ko).toBeTruthy();
  });
  it("verse-count table covers every chapter", () => {
    expect(VERSE_COUNTS).toHaveLength(66);
    expect(VERSE_COUNTS[18]).toHaveLength(150);
    expect(VERSE_COUNTS[42][2]).toBe(36);
  });
  it("tags verses with their segment and builds ESV labels", () => {
    const r = lookupPassages("Rom 8:1-2, 28", { korean });
    expect(r.passages[0].verses.map((v) => v.seg)).toEqual([0, 0, 1]);
    expect(r.passages[0].segmentLabels).toEqual(["Romans 8:1-2", "Romans 8:28"]);
  });
  it("caps very large requests", () => {
    const r = lookupPassages("Psalms 119", { korean, english, maxVerses: 50 });
    expect(r.passages[0].verses).toHaveLength(50);
  });
});

describe("your scripture lists", () => {
  for (const list of SCRIPTURE_LISTS) {
    for (const [ref] of list.passages) {
      it(`${list.id}: ${ref} resolves`, () => {
        const parsed = parseReferences(ref);
        expect(parsed?.refs.length).toBeGreaterThan(0);
        const r = lookupPassages(ref, { korean, english });
        expect(r.warnings).toEqual([]);
        expect(r.passages[0].verses.every((v) => v.ko)).toBe(true);
      });
    }
  }
});

describe("word list data", () => {
  it("every entry has Korean and English", () => {
    for (const list of WORD_LISTS) {
      for (const entry of list.entries) {
        expect(entry[0], `${list.id}`).toBeTruthy();
        expect(entry[1], `${list.id} ${entry[0]}`).toBeTruthy();
      }
    }
  });
  it("list ids are unique", () => {
    const ids = WORD_LISTS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ESV text distribution", () => {
  const vs = (...refs) => refs.map(([chapter, verse]) => ({ chapter, verse }));
  it("splits verse markers onto verses", () => {
    const out = distributeEsvText(" [16] For God so loved the world... [17] For God did not send... (ESV)", vs([3, 16], [3, 17]));
    expect(out).toEqual(["For God so loved the world...", "For God did not send..."]);
  });
  it("handles chapter-number markers across chapters", () => {
    const out = distributeEsvText("[24] So his fame spread [25] And great crowds [5] Seeing the crowds [2] And he opened", vs([4, 24], [4, 25], [5, 1], [5, 2]));
    expect(out[2]).toBe("Seeing the crowds");
    expect(out[3]).toBe("And he opened");
  });
  it("leaves verses the ESV omits undefined", () => {
    const out = distributeEsvText("[20] He said to them [22] As they were gathering", vs([17, 20], [17, 21], [17, 22]));
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBe("As they were gathering");
  });
  it("returns null when nothing lines up", () => {
    expect(distributeEsvText("no markers here", vs([1, 1]))).toBeNull();
  });
  it("applies per-segment ESV texts and reports omitted verses", () => {
    const { passages } = expandReferences({ refs: [{ book: { index: 39, en: "Matthew", ko: "마태복음", chapters: 28 }, segments: [{ startChapter: 17, startVerse: 20, endChapter: 17, endVerse: 22 }] }], errors: [] });
    const result = applyEsvTexts(passages, ["[20] He said to them [22] As they were gathering"]);
    expect(result).toEqual({ ok: true, omitted: ["Matthew 17:21"] });
    expect(passages[0].verses.map((v) => v.en)).toEqual(["He said to them", "", "As they were gathering"]);
  });
  it("changes nothing when ESV text can't be aligned", () => {
    const { passages } = expandReferences({ refs: [{ book: { index: 42, en: "John", ko: "요한복음", chapters: 21 }, segments: [{ startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 16 }] }], errors: [] });
    expect(applyEsvTexts(passages, ["no markers"]).ok).toBe(false);
    expect(passages[0].verses[0].en).toBeUndefined();
  });
});
