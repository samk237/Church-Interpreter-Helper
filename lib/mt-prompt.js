/**
 * Prompt for the local LLM fallback (Ollama). Only used for text NOT answered by your word lists.
 */

/** A single term or short phrase (gets a dictionary-style gloss instead of a sentence). */
export function isShortTerm(text) {
  const t = String(text ?? "").trim();
  return t.split(/\s+/).length <= 2 && t.length <= 15 && !/[.!?。]$/.test(t);
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

/** Strip quotes / labels small models sometimes add. */
export function cleanModelOutput(out) {
  return String(out ?? "")
    .trim()
    .replace(/^(English|Korean|Translation)\s*:\s*/i, "")
    .replace(/^["“'](.*)["”']$/s, "$1")
    .split(/\n\s*\n/)[0]
    .trim();
}
