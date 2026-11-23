/**
 * Prompt for the local LLM fallback (Ollama). Only used for text NOT answered by your word lists.
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
 * Prompt for a single term that returns JSON so the model can also say what was probably meant
 * when the word was typed by ear (misspelled).
 */
export function buildTermPrompt(text, sourceLang) {
  if (sourceLang === "ko") {
    return [
      "You help a Korean->English church interpreter during a live service. They typed a Korean term by ear, so it may be misspelled.",
      `Typed: "${text}"`,
      "Reply with JSON only:",
      '{"term": "<the correctly spelled standard Korean word they most likely meant; the same as typed if it is already a real word>",',
      ' "english": "<its standard English equivalent as used in churches/theology, 1-4 words; give two renderings separated by \' / \' if both are common>"}',
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

/** Parse the JSON term reply. Returns { translation, corrected|null } or null. */
export function parseTermResponse(raw, typed, sourceLang) {
  let obj;
  try {
    obj = JSON.parse(String(raw ?? "").trim().replace(/^```(?:json)?|```$/g, ""));
  } catch {
    return null;
  }
  const translation = String((sourceLang === "ko" ? obj.english : obj.korean) ?? "").trim();
  if (!translation) return null;
  const term = String(obj.term ?? "").trim();
  const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
  const corrected = term && norm(term) !== norm(typed) ? term : null;
  return { translation: cleanModelOutput(translation), corrected };
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
