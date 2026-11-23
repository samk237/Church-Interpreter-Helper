import { describe, it, expect, vi } from "vitest";
import { claudeProvider, geminiProvider, parseTranslateRequest, translateWithProviders } from "../server/core/ai.js";
import { upsertWord, removeWord } from "../server/core/custom-words.js";
import { esvKeyUsable, fetchEsvTexts, parseEsvRefs } from "../server/core/esv.js";
import { makeSessionToken, passwordMatches, readCookie, verifySessionToken } from "../server/core/auth.js";

const fake = (id, answer, strong = true) => ({ id, label: id, strong, complete: vi.fn(async () => answer) });
const failing = (id) => ({ id, label: id, strong: true, complete: vi.fn(async () => Promise.reject(new Error("down"))) });

describe("translateWithProviders", () => {
  it("asks strong providers for Korean did-you-mean on single words", async () => {
    const p = fake("cloud", '{"typed_is_standard": false, "suggestions": [{"korean":"구제","english":"almsgiving"}], "english": "almsgiving"}');
    const r = await translateWithProviders([p], { text: "구재", sourceLang: "ko" });
    expect(r).toMatchObject({ translatedText: "almsgiving", corrected: "구제", typedIsStandard: false, provider: "cloud" });
    expect(p.complete.mock.calls[0][1]).toMatchObject({ json: true });
  });
  it("uses the plain prompt for Korean on weaker (local) models", async () => {
    const p = fake("local", "Home visitation", false);
    const r = await translateWithProviders([p], { text: "심방", sourceLang: "ko" });
    expect(r).toMatchObject({ translatedText: "Home visitation", corrected: null, suggestions: [] });
    expect(p.complete.mock.calls[0][1].json).toBeFalsy();
  });
  it("falls through to the next provider on failure", async () => {
    const r = await translateWithProviders([failing("gemini"), fake("ollama", "Let us persevere.", false)], { text: "우리가 끝까지 인내합시다", sourceLang: "ko" });
    expect(r.provider).toBe("ollama");
  });
  it("reports when nothing is available", async () => {
    await expect(translateWithProviders([], { text: "x", sourceLang: "en" })).rejects.toThrow(/No AI provider/);
    await expect(translateWithProviders([failing("a")], { text: "x", sourceLang: "en" })).rejects.toMatchObject({ detail: "a: down" });
  });
  it("validates requests", () => {
    expect(parseTranslateRequest({ text: "", sourceLang: "ko" }).error).toBeTruthy();
    expect(parseTranslateRequest({ text: "심방", sourceLang: "ko", hints: [{ ko: "a", en: "b" }, { bad: 1 }] })).toEqual({ text: "심방", sourceLang: "ko", hints: [{ ko: "a", en: "b" }] });
  });
});

describe("gemini provider", () => {
  it("sends a generateContent request and reads the text", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hello" }] } }] })));
    const p = geminiProvider({ apiKey: "k", model: "gemini-3.5-flash-lite", fetchImpl });
    expect(await p.complete("prompt", { json: true, maxTokens: 50 })).toBe("hello");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body);
    expect(body.generationConfig).toEqual({ maxOutputTokens: 50, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "MINIMAL" } });
  });
  it("retries without thinking settings if the model rejects them", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] })));
    expect(await geminiProvider({ apiKey: "k", fetchImpl }).complete("p")).toBe("ok");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).generationConfig.thinkingConfig).toBeUndefined();
  });
  it("throws on errors so the next provider is tried", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 429 }));
    await expect(geminiProvider({ apiKey: "k", model: "gemini-2.5-flash-lite", fetchImpl }).complete("p")).rejects.toThrow(/429/);
  });
});

describe("claude provider", () => {
  it("uses low effort, server-side fallbacks, and joins text blocks", async () => {
    const create = vi.fn(async () => ({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: '{"english":"x"}' }] }));
    const p = claudeProvider({ apiKey: "k", client: { beta: { messages: { create } } } });
    expect(await p.complete("prompt")).toBe('{"english":"x"}');
    expect(create.mock.calls[0][0]).toMatchObject({ model: "claude-opus-5-5", output_config: { effort: "low" }, fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
  });
  it("treats a refusal as a failure", async () => {
    const create = vi.fn(async () => ({ stop_reason: "refusal", content: [] }));
    await expect(claudeProvider({ apiKey: "k", client: { beta: { messages: { create } } } }).complete("p")).rejects.toThrow(/declined/);
  });
});

describe("custom word rules", () => {
  const base = [{ ko: "희년", en: "Jubilee", note: "", status: "confirmed", addedAt: "t0" }];
  it("adds and updates", () => {
    const { words } = upsertWord(base, { ko: "심방", en: "home visitation", status: "ai" }, "t1");
    expect(words.find((w) => w.ko === "심방")).toMatchObject({ status: "ai", addedAt: "t1" });
    const confirmed = upsertWord(words, { ko: "심방", en: "pastoral visit" }, "t2").words.find((w) => w.ko === "심방");
    expect(confirmed).toMatchObject({ en: "pastoral visit", status: "confirmed", reviewedAt: "t2" });
  });
  it("never lets an AI suggestion overwrite an existing word", () => {
    const r = upsertWord(base, { ko: "희년", en: "something else", status: "ai" });
    expect(r.changed).toBe(false);
    expect(r.words[0].en).toBe("Jubilee");
  });
  it("renames when fixing a spelling", () => {
    const { words } = upsertWord(base, { ko: "희년절", en: "Jubilee", replaces: "희년" });
    expect(words.map((w) => w.ko)).toEqual(["희년절"]);
  });
  it("requires both languages and removes words", () => {
    expect(upsertWord(base, { ko: "x" }).error).toBeTruthy();
    expect(removeWord(base, "희년")).toEqual([]);
  });
});

describe("ESV helpers", () => {
  it("accepts reference labels only", () => {
    expect(parseEsvRefs(JSON.stringify(["Romans 8:1-2", "1 John 3:8", "Jude 3"]))).toHaveLength(3);
    expect(parseEsvRefs(JSON.stringify(["<script>"]))).toBeNull();
    expect(parseEsvRefs("not json")).toBeNull();
    expect(parseEsvRefs(JSON.stringify(Array(21).fill("John 1:1")))).toBeNull();
  });
  it("recognises placeholder keys", () => {
    expect(esvKeyUsable("your_esv_api_key_here")).toBe(false);
    expect(esvKeyUsable("")).toBe(false);
    expect(esvKeyUsable("abc123")).toBe(true);
  });
  it("fetches with the token header and caches", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ passages: [" [16] For God so loved"] })));
    const cache = new Map();
    expect(await fetchEsvTexts(["John 3:16"], { apiKey: "k", cache, fetchImpl })).toEqual([" [16] For God so loved"]);
    await fetchEsvTexts(["John 3:16"], { apiKey: "k", cache, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Token k");
  });
});

describe("website login", () => {
  it("checks passwords", async () => {
    expect(await passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(await passwordMatches("wrong", "correct horse")).toBe(false);
    expect(await passwordMatches("x", "")).toBe(false);
  });
  it("signs and verifies session tokens", async () => {
    const token = await makeSessionToken("secret", 1000, 1);
    expect(await verifySessionToken(token, "secret", 2000)).toBe(true);
    expect(await verifySessionToken(token, "other-secret", 2000)).toBe(false); // password changed
    expect(await verifySessionToken(token, "secret", 1000 + 2 * 86400000)).toBe(false); // expired
    expect(await verifySessionToken("123.deadbeef", "secret", 0)).toBe(false);
  });
  it("reads cookies", () => {
    expect(readCookie("a=1; cih_session=abc.def; b=2", "cih_session")).toBe("abc.def");
    expect(readCookie("", "x")).toBe("");
  });
});
