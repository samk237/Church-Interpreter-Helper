import { describe, it, expect } from "vitest";
import { isShortTerm, parseTermResponse, cleanModelOutput, buildTranslatePrompt } from "../lib/mt-prompt.js";
import { buildGlossary } from "../lib/glossary.js";
import { WORD_LISTS } from "../data/word-lists.js";

describe("mt prompt helpers", () => {
  it("detects single terms vs sentences", () => {
    expect(isShortTerm("심방")).toBe(true);
    expect(isShortTerm("home visitation")).toBe(true);
    expect(isShortTerm("우리가 낙심하지 말고 끝까지 인내합시다")).toBe(false);
    expect(isShortTerm("우리가 인내합시다")).toBe(false);
    expect(isShortTerm("시기하다")).toBe(true);
  });
  it("parses English spelling corrections", () => {
    expect(parseTermResponse('{"term":"providence","korean":"섭리"}', "providance", "en")).toMatchObject({ translation: "섭리", corrected: "providence" });
    expect(parseTermResponse('{"term":"jubilee","korean":"희년"}', "jubilee", "en")).toMatchObject({ translation: "희년", corrected: null, suggestions: [] });
    expect(parseTermResponse("not json", "x", "en")).toBeNull();
  });
  it("parses Korean did-you-mean suggestions", () => {
    const r = parseTermResponse(
      'Sure: ```json\n{"typed_is_standard": false, "suggestions": [{"korean":"구제","english":"almsgiving / relief"},{"korean":"구재","english":"x"}], "english": "almsgiving / relief"}\n```',
      "구재",
      "ko"
    );
    expect(r).toEqual({ translation: "almsgiving / relief", corrected: "구제", suggestions: [{ term: "구제", translation: "almsgiving / relief" }], typedIsStandard: false });
  });
  it("treats a standard Korean word as-is", () => {
    const r = parseTermResponse('{"typed_is_standard": true, "suggestions": [], "english": "home visitation"}', "심방", "ko");
    expect(r).toMatchObject({ translation: "home visitation", corrected: null, suggestions: [], typedIsStandard: true });
  });
  it("cleans model output", () => {
    expect(cleanModelOutput('English: "Home visitation"')).toBe("Home visitation");
    expect(cleanModelOutput("희년 (희년은 종교적 의미에서 주로 사용되며 성경에서)")).toBe("희년");
  });
  it("forbids verse substitution in sentence prompts", () => {
    expect(buildTranslatePrompt("우리가 인내합시다", "ko")).toMatch(/Do NOT replace it with a Bible verse/);
  });
});

describe("AI-suggested words in the glossary", () => {
  const g = buildGlossary(WORD_LISTS, [
    { ko: "심방", en: "home visitation", status: "ai" },
    { ko: "희년", en: "Year of Jubilee", status: "confirmed" },
    { ko: "감동", en: "deeply moved", status: "ai" },
  ]);
  it("marks unreviewed AI words", () => {
    expect(g.get("심방").ai).toBe(true);
    expect(g.get("심방").lists).toEqual(["ai"]);
    expect(g.lookup("심방").exact[0].ko).toBe("심방"); // instant next time, no model call
  });
  it("confirmed words are normal custom words", () => {
    expect(g.get("희년").ai).toBe(false);
    expect(g.get("희년").custom).toBe(true);
  });
  it("an AI sense on a word you already have doesn't make it an AI word", () => {
    expect(g.get("감동").ai).toBe(false);
  });
});
