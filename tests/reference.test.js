import { describe, it, expect } from "vitest";
import { parseReferences, formatReference, looksLikeReference, normalizeReferenceText } from "../lib/reference.js";
import { findBook, BOOKS } from "../lib/bible-books.js";

const label = (q, lang = "en") => {
  const r = parseReferences(q);
  return r ? r.refs.map((x) => formatReference(x, lang)).join("; ") : null;
};

describe("book aliases", () => {
  it("has 66 books", () => expect(BOOKS).toHaveLength(66));
  it.each([
    ["Jn", "John"], ["jhn", "John"], ["요", "John"], ["요한복음", "John"],
    ["1Jn", "1 John"], ["1 John", "1 John"], ["I John", "1 John"], ["first john", "1 John"], ["요일", "1 John"],
    ["Rom", "Romans"], ["롬", "Romans"], ["Ps", "Psalms"], ["Psalm", "Psalms"], ["시", "Psalms"],
    ["Song of Songs", "Song of Songs"], ["아가", "Song of Songs"], ["Jon", "Jonah"],
    ["1 Thess", "1 Thessalonians"], ["살전", "1 Thessalonians"], ["2 Cor", "2 Corinthians"], ["고후", "2 Corinthians"],
    ["렘", "Jeremiah"], ["예", "Jeremiah"], ["대상", "1 Chronicles"], ["역대상", "1 Chronicles"],
  ])("%s -> %s", (alias, en) => expect(findBook(alias)?.en).toBe(en));
});

describe("parseReferences", () => {
  it.each([
    ["Jn 3:16", "John 3:16"],
    ["Mt 16:16 -20", "Matthew 16:16-20"],
    ["Rom 16:25 -27", "Romans 16:25-27"],
    ["1 Thessalonians 5:16-18", "1 Thessalonians 5:16-18"],
    ["1Jn 3:8", "1 John 3:8"],
    ["롬 10:17", "Romans 10:17"],
    ["예 33:3", "Jeremiah 33:3"],
    ["요한복음 3장 16-18절", "John 3:16-18"],
    ["요 3장 16절", "John 3:16"],
    ["시편 23편", "Psalms 23"],
    ["마 5:3~12", "Matthew 5:3-12"],
    ["Rom 8:1-2, 28", "Romans 8:1-2, 28"],
    ["Rom 8:28, 9:1-3", "Romans 8:28, 9:1-3"],
    ["Eph 6:10-18; Jas 4:7", "Ephesians 6:10-18; James 4:7"],
    ["John 3:16; 4:1", "John 3:16; John 4:1"],
    ["Matthew 4:23-5:2", "Matthew 4:23-5:2"],
    ["Jude 3", "Jude 3"],
    ["Jude 3-5", "Jude 3-5"],
    ["Romans 8", "Romans 8"],
    ["John 3.16", "John 3:16"],
  ])("%s", (q, expected) => expect(label(q)).toBe(expected));

  it("gives Korean labels", () => {
    expect(label("Jn 3:16-18", "ko")).toBe("요한복음 3:16-18");
    expect(label("1 Pet 2:9", "ko")).toBe("베드로전서 2:9");
  });

  it("returns null for normal words", () => {
    for (const q of ["은혜", "hello there", "40주야", "born again", "comfort", "100만"]) expect(parseReferences(q)).toBeNull();
  });

  it("reports out-of-range chapters", () => {
    const r = parseReferences("Acts 99:1");
    expect(r.refs).toHaveLength(0);
    expect(r.errors.join(" ")).toMatch(/28 chapters/);
  });

  it("normalises Korean chapter/verse words", () => {
    expect(normalizeReferenceText("요 3장 16절-18절")).toBe("요 3:16-18");
  });

  it("looksLikeReference", () => {
    expect(looksLikeReference("행 1:8")).toBe(true);
    expect(looksLikeReference("Acts 99:1")).toBe(true); // invalid, but clearly a reference → show the error
    expect(looksLikeReference("성령")).toBe(false);
    expect(looksLikeReference("40주야")).toBe(false);
  });
});
