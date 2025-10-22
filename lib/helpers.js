/**
 * Church Interpreter Helper - Shared utility functions
 * These functions are extracted from app.js for testability and reusability
 */

/**
 * Normalize a token for case-insensitive comparison
 * @param {string} token - The token to normalize
 * @param {boolean} isKoreanSource - Whether the source language is Korean
 * @returns {string} Normalized token
 */
export function normalizeToken(token, isKoreanSource) {
  if (!token) return "";
  return isKoreanSource ? token : token.toLowerCase();
}

/**
 * Check if text contains Hangul (Korean) characters
 * @param {string} text - The text to check
 * @returns {boolean} True if text contains Hangul
 */
export function containsHangul(text) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

/**
 * Apply case pattern from reference text to source text
 * @param {string} source - The source text
 * @param {string} reference - The reference text with desired case pattern
 * @returns {string} Source text with applied case
 */
export function applyCase(source, reference) {
  if (reference === reference.toUpperCase()) {
    return source.toUpperCase();
  }
  if (reference[0] === reference[0]?.toUpperCase()) {
    return source.charAt(0).toUpperCase() + source.slice(1);
  }
  return source;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Levenshtein distance
 */
export function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Tokenize text into tokens with original and stripped forms
 * @param {string} text - The text to tokenize
 * @returns {Array<{original: string, strip: string}>} Array of tokens
 */
export function tokenize(text) {
  const regex = /[\p{L}'']+|\d+|[^\s\p{L}\d]+/gu;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const original = match[0];
    const strip = original.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
    matches.push({
      original,
      strip,
    });
  }
  return matches;
}

/**
 * Rebuild text from tokens and translated tokens
 * @param {Array<{original: string, strip: string}>} tokens - Original tokens
 * @param {Array<string>} translatedTokens - Translated tokens
 * @returns {string} Rebuilt text
 */
export function rebuildText(tokens, translatedTokens) {
  let cursor = 0;
  return tokens
    .map((token, index) => {
      const translated = translatedTokens[index];
      const nextIndex = cursor + token.original.length;
      cursor = nextIndex;
      return translated ?? token.original;
    })
    .join(" ");
}

/**
 * Format a scripture reference for API call
 * @param {Object} request - Scripture request object
 * @param {string} request.canonical - Canonical book name
 * @param {number} request.chapter - Chapter number
 * @param {number} [request.verseStart] - Starting verse
 * @param {number} [request.verseEnd] - Ending verse
 * @returns {string} Formatted reference
 */
export function formatReferenceForApi(request) {
  const chapterSegment = request.chapter ? `${request.canonical} ${request.chapter}` : request.canonical;
  if (!request.verseStart) {
    return chapterSegment;
  }
  if (request.verseEnd && request.verseEnd !== request.verseStart) {
    return `${chapterSegment}:${request.verseStart}-${request.verseEnd}`;
  }
  return `${chapterSegment}:${request.verseStart}`;
}

/**
 * Get label for message role
 * @param {string} role - The role (user, assistant, system)
 * @returns {string} Display label for the role
 */
export function roleLabel(role) {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Helper";
    case "system":
      return "System";
    default:
      return role;
  }
}

/**
 * Generate a UUID v4
 * @returns {string} UUID v4
 */
export function generateId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
