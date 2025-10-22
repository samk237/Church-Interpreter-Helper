/**
 * Church Interpreter Helper - Dictionary utilities
 */

/**
 * Build dictionary maps for efficient lookup
 * @param {Array<{ko: string, en: string}>} baseDictionary - Base dictionary entries
 * @returns {Object} Object with KO_TO_EN and EN_TO_KO maps
 */
export function buildDictionaryMaps(baseDictionary) {
  const KO_TO_EN = new Map(baseDictionary.map((entry) => [entry.ko, entry.en]));
  const EN_TO_KO = new Map(baseDictionary.map((entry) => [entry.en.toLowerCase(), entry.ko]));
  return { KO_TO_EN, EN_TO_KO };
}

/**
 * Suggest similar terms using Levenshtein distance
 * @param {string} token - Token to find suggestions for
 * @param {string} language - Source language ('ko' or 'en')
 * @param {Array<{ko: string, en: string}>} baseDictionary - Base dictionary
 * @param {Function} levenshteinDistance - Distance calculation function
 * @returns {Array<{source: string, target: string}>} Suggested terms
 */
export function suggestSimilar(token, language, baseDictionary, levenshteinDistance) {
  const dictionary = language === "ko"
    ? baseDictionary.map((entry) => entry.ko)
    : baseDictionary.map((entry) => entry.en);
  const targetDictionary = language === "ko"
    ? baseDictionary.map((entry) => ({ source: entry.ko, target: entry.en }))
    : baseDictionary.map((entry) => ({ source: entry.en, target: entry.ko }));

  const scored = dictionary.map((entry, idx) => ({
    score: levenshteinDistance(token, entry),
    entry: targetDictionary[idx],
  }));

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .filter((candidate) => candidate.score < Math.max(token.length, 4))
    .map((candidate) => candidate.entry);
}

/**
 * Lookup a phrase in the dictionary
 * @param {string} phrase - Phrase to look up
 * @param {string} sourceLang - Source language ('ko' or 'en')
 * @param {Object} maps - Dictionary maps (KO_TO_EN and EN_TO_KO)
 * @param {Object} glossary - Session glossary
 * @returns {Object|null} Lookup result with translated text or null
 */
export function lookupPhrase(phrase, sourceLang, maps, glossary) {
  // Check glossary first
  const normalized = sourceLang === "ko" ? phrase : phrase.toLowerCase();
  const fromGlossary = glossary[normalized];
  if (fromGlossary) {
    return { translated: fromGlossary };
  }

  // Check dictionary
  if (sourceLang === "ko") {
    const hit = maps.KO_TO_EN.get(phrase);
    if (hit) return { translated: hit };
  } else {
    const hit = maps.EN_TO_KO.get(phrase.toLowerCase());
    if (hit) return { translated: hit };
  }

  return null;
}

/**
 * Lookup a token in the dictionary
 * @param {Object} token - Token object with original and strip properties
 * @param {boolean} isKoreanSource - Whether source is Korean
 * @param {Object} maps - Dictionary maps
 * @param {Object} glossary - Session glossary
 * @param {Function} normalizeToken - Token normalization function
 * @param {Function} applyCase - Case application function
 * @returns {Object} Lookup result with found status and value
 */
export function lookupToken(token, isKoreanSource, maps, glossary, normalizeToken, applyCase) {
  const normalized = normalizeToken(token.strip, isKoreanSource);
  if (!normalized) {
    return { found: false, value: token.original };
  }

  const glossaryHit = glossary[normalized];
  if (glossaryHit) {
    return { found: true, value: applyCase(glossaryHit, token.original) };
  }

  if (isKoreanSource) {
    const dictionaryHit = maps.KO_TO_EN.get(token.strip);
    if (dictionaryHit) {
      return { found: true, value: applyCase(dictionaryHit, token.original) };
    }
  } else {
    const dictionaryHit = maps.EN_TO_KO.get(token.strip.toLowerCase());
    if (dictionaryHit) {
      return { found: true, value: dictionaryHit };
    }
  }

  return { found: false, value: token.original };
}
