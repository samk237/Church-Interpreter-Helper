import { describe, it, expect } from "vitest";
import { buildGlossary, englishPhrases } from "../lib/glossary.js";
import { WORD_LISTS } from "../data/word-lists.js";
import { conjugationForms, toJamo, toChoseong, stripParticle, editDistance } from "../lib/korean.js";

const g = buildGlossary(WORD_LISTS);
const exactKo = (q) => g.lookup(q).exact.map((e) => e.ko);
const foundKo = (q) => g.lookup(q).found.map((m) => m.entry.ko);

describe("korean helpers", () => {
  it("decomposes jamo", () => expect(toJamo("맹세")).toEqual(["ㅁ", "ㅐ", "ㅇ", "ㅅ", "ㅔ"]));
  it("choseong", () => expect(toChoseong("중보 기도")).toBe("ㅈㅂㄱㄷ"));
  it("strips particles", () => {
    expect(stripParticle("은혜를")).toBe("은혜");
    expect(stripParticle("하나님께서")).toBe("하나님");
  });
  it("conjugation forms", () => {
    expect(conjugationForms("시기하다")).toEqual(expect.arrayContaining(["시기하", "시기했", "시기"]));
    expect(conjugationForms("망설이다")).toEqual(expect.arrayContaining(["망설이", "망설였"]));
    expect(conjugationForms("이룬다")).toEqual(expect.arrayContaining(["이루"]));
  });
  it("edit distance", () => expect(editDistance("kitten", "sitting")).toBe(3));
});

describe("merging word lists", () => {
  it("keeps every meaning of a repeated word instead of overwriting", () => {
    const e = g.get("감동");
    const meanings = e.senses.map((s) => s.en);
    expect(meanings).toEqual(expect.arrayContaining(["inspired", "touched / moved / impressed", "moved / inspired"]));
    expect(e.lists).toEqual(expect.arrayContaining(["wl1", "wl3"]));
  });
  it("keeps both meanings of 마음이 아프다", () => {
    expect(g.get("마음이 아프다").en).toMatch(/feelings were hurt/);
    expect(g.get("마음이 아프다").en).toMatch(/heartbroken/);
  });
  it("adds custom words as their own list", () => {
    const g2 = buildGlossary(WORD_LISTS, [{ ko: "새단어", en: "new word" }]);
    expect(g2.get("새단어").custom).toBe(true);
    expect(g2.lookup("new word").exact[0].ko).toBe("새단어");
  });
});

describe("Korean lookup", () => {
  it("exact", () => expect(exactKo("칭의")).toEqual(["칭의"]));
  it("ignores spacing", () => {
    expect(exactKo("하늘 나라에 돌아간다")).toEqual(["하늘나라에 돌아간다"]);
    expect(exactKo("심리치료")).toEqual(["심리 치료"]);
  });
  it("accepts your original spellings", () => {
    expect(exactKo("맹새")).toEqual(["맹세"]);
    expect(exactKo("수면재")).toEqual(["수면제"]);
    expect(exactKo("귀복주의")).toEqual(["기복주의"]);
  });
  it("strips particles", () => expect(exactKo("중보기도를")).toEqual(["중보기도"]));
  it("handles conjugations", () => {
    expect(foundKo("시기했다")).toEqual(["시기하다"]);
    expect(foundKo("애통하며")).toEqual(["애통하다"]);
    expect(foundKo("망설였다")).toEqual(["망설이다"]);
  });
  it("scans sentences for every glossary word", () => {
    const found = foundKo("오늘 우리가 성령내주의 은혜와 칭의, 성화에 대해서 말씀을 사모하는 마음으로 예배를 드립니다");
    expect(found).toEqual(expect.arrayContaining(["성령내주", "은혜", "칭의", "성화", "말씀을 사모", "예배"]));
  });
  it("does not flag very common single syllables inside sentences", () => {
    expect(foundKo("한 사람이 기도하고")).not.toContain("한");
  });
  it("suggests close spellings for unknown words", () => {
    const s = g.lookup("맹세하는것").suggestions.concat(g.lookup("맹세하는것").found.map((f) => f.entry));
    expect(s.map((e) => e.ko)).toContain("맹세");
  });
  it("supports 초성 shortcuts", () => expect(g.lookup("ㅈㅂㄱㄷ").suggestions.map((e) => e.ko)).toContain("중보기도"));
  it("is deterministic", () => {
    const a = JSON.stringify(g.lookup("은혜를 사모하는").found.map((m) => m.entry.ko));
    const b = JSON.stringify(buildGlossary(WORD_LISTS).lookup("은혜를 사모하는").found.map((m) => m.entry.ko));
    expect(a).toBe(b);
  });
});

describe("English lookup", () => {
  it("reverse lookup", () => expect(exactKo("temptation")).toContain("유혹"));
  it("finds all three jealousy words", () => expect(exactKo("jealous")).toEqual(expect.arrayContaining(["질투", "시기"])));
  it("stems plurals", () => expect(exactKo("signs")).toContain("표적"));
  it("phrase", () => expect(exactKo("intercessory prayer")).toContain("중보기도"));
  it("splits meanings into phrases", () => {
    expect(englishPhrases("to be WORN OUT")).toEqual(["worn out"]);
    expect(englishPhrases("redeem / atonement")).toEqual(["redeem", "atonement"]);
  });
});

describe("autocomplete", () => {
  it("prefix", () => expect(g.autocomplete("중보").map((e) => e.ko)).toEqual(expect.arrayContaining(["중보", "중보기도"])));
  it("english", () => expect(g.autocomplete("tempt").map((e) => e.ko)).toContain("유혹"));
});
