/**
 * Prompts for the AI fallback (cloud Gemini / Claude / Workers AI, or local Ollama).
 * Only used for text NOT answered by your word lists. Shared by the Mac server, the website,
 * and the browser (isShortTerm).
 */

/** A single term or short phrase (gets a dictionary-style gloss instead of a sentence). */
export function isShortTerm(text) {
  const t = String(text ?? "").trim();
  const words = t.split(/\s+/);
  if (words.length > 2 || t.length > 15 || /[.!?。]$/.test(t)) return false;
  // "우리가 인내합시다" is a sentence: several words ending in a verb
  if (words.length > 1 && /(다|요|까|죠)$/.test(t)) return false;
  return true;
}

export function buildTranslatePrompt(text, sourceLang, hints = []) {
  const src = sourceLang === "ko" ? "Korean" : "English";
  const tgt = sourceLang === "ko" ? "English" : "Korean";
  const glossary = hints.length
    ? ["Use EXACTLY these glossary translations where they appear:", ...hints.map((h) => `- ${h.ko} = ${h.en}`), ""]
    : [];
  const task = isShortTerm(text)
    ? [
        `This is a single ${src} term heard in a church service. Give its standard ${tgt} equivalent as used in churches and theology.`,
        `Answer with 1-4 words. If there are two common renderings, give both separated by " / ". No explanation.`,
      ]
    : [
        `Translate the ${src} text into natural ${tgt} suitable for a church service.`,
        "Translate faithfully: keep the speaker's exact meaning and sentence. Do NOT replace it with a Bible verse, do NOT add or drop ideas.",
        "Return ONLY the translation — no notes, no quotes, no romanization.",
      ];
  return [
    "You are an expert bilingual church interpreter (Korean <-> English) with deep knowledge of Christian and Reformed theological vocabulary.",
    ...glossary,
    ...task,
    "",
    `${src}: ${text}`,
    `${tgt}:`,
  ].join("\n");
}

/**
 * Prompt for a single term that returns JSON so the model can also say what was probably meant.
 * Korean "did you mean" is only asked of strong (cloud) models — small local models guessed wrong too often.
 */
export function buildTermPrompt(text, sourceLang) {
  if (sourceLang === "ko") {
    return [
      "You help a Korean->English church interpreter during a live sermon. They typed a Korean word or short phrase BY EAR,",
      "so it may be misspelled: similar-sounding vowels (ㅐ/ㅔ, ㅓ/ㅗ, ㅚ/ㅙ/ㅞ), a wrong or missing final consonant, ㄴ/ㄹ, tense consonants, or spacing.",
      `Typed: "${text}"`,
      "Reply with JSON only, in exactly this shape:",
      "{",
      '  "typed_is_standard": <true if the typed text, exactly as typed, is a real standard Korean word or phrase likely in a church or sermon; otherwise false>,',
      '  "suggestions": [<only when typed_is_standard is false: up to 3 objects {"korean": "<correctly spelled word they most likely meant>", "english": "<its church/theology English, 1-4 words>"}, most likely first>],',
      '  "english": "<English equivalent (1-4 words; two common renderings separated by \' / \') of the typed text if standard, otherwise of the first suggestion>"',
      "}",
      "Never invent a word. If you are not sure what was meant, give your best guesses as suggestions.",
    ].join("\n");
  }
  return [
    "You help an English->Korean church interpreter. They typed an English term, possibly misspelled.",
    `Typed: "${text}"`,
    "Reply with JSON only:",
    '{"term": "<the correctly spelled English word they most likely meant; the same as typed if already correct>",',
    ' "korean": "<its standard Korean equivalent as used in Korean churches, 1-4 words; two renderings separated by \' / \' if both are common>"}',
  ].join("\n");
}

/** Pull the first {...} JSON object out of a reply (some models wrap it in prose or ``` fences). */
function extractJson(raw) {
  const s = String(raw ?? "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Parse the JSON term reply.
 * Returns { translation, corrected|null, suggestions: [{term, translation}], typedIsStandard } or null.
 *   corrected = the spelling the AI thinks was meant (null when the typed text is fine)
 */
export function parseTermResponse(raw, typed, sourceLang) {
  const obj = extractJson(raw);
  if (!obj || typeof obj !== "object") return null;
  const norm = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

  if (sourceLang === "ko") {
    const suggestions = (Array.isArray(obj.suggestions) ? obj.suggestions : [])
      .map((x) => ({ term: String(x?.korean ?? "").trim(), translation: cleanModelOutput(x?.english) }))
      .filter((x) => x.term && x.translation && norm(x.term) !== norm(typed))
      .slice(0, 3);
    const typedIsStandard = obj.typed_is_standard !== false || suggestions.length === 0;
    const translation = cleanModelOutput(obj.english) || suggestions[0]?.translation || "";
    if (!translation) return null;
    return {
      translation,
      corrected: typedIsStandard ? null : suggestions[0].term,
      suggestions: typedIsStandard ? [] : suggestions,
      typedIsStandard,
    };
  }

  const translation = cleanModelOutput(obj.korean);
  if (!translation) return null;
  const term = String(obj.term ?? "").trim();
  const corrected = term && norm(term) !== norm(typed) ? term : null;
  return { translation, corrected, suggestions: corrected ? [{ term: corrected, translation }] : [], typedIsStandard: !corrected };
}

/** Strip quotes / labels small models sometimes add. */
export function cleanModelOutput(out) {
  return String(out ?? "")
    .trim()
    .replace(/^(English|Korean|Translation)\s*:\s*/i, "")
    .replace(/^["“'](.*)["”']$/s, "$1")
    .split(/\n\s*\n/)[0]
    .replace(/\s*\([^)]{20,}\)\s*$/, "") // drop long trailing explanations
    .trim();
}
