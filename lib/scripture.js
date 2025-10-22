/**
 * Church Interpreter Helper - Scripture utilities
 */

/**
 * Parse a scripture query string into a request object
 * Supports formats like "John 3", "John 3:16", "John 3:16-18", "요한복음 3:16"
 * @param {string} raw - The raw scripture query
 * @param {Object} bookAliases - Map of book name aliases to canonical names
 * @returns {Object|null} Scripture request object or null if invalid
 */
export function parseScriptureQuery(raw, bookAliases) {
  const trimmed = raw.trim();
  const pattern = /^([\p{L}\s]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/u;
  const match = trimmed.match(pattern);
  if (!match) return null;

  const alias = match[1].trim().toLowerCase();
  const chapter = Number.parseInt(match[2], 10);
  const verseStart = match[3] ? Number.parseInt(match[3], 10) : null;
  const verseEnd = match[4] ? Number.parseInt(match[4], 10) : null;

  const bookInfo = bookAliases[alias];
  if (!bookInfo) return null;

  return {
    canonical: bookInfo.canonical,
    language: bookInfo.language,
    chapter,
    verseStart,
    verseEnd,
  };
}

/**
 * Format verses from API response
 * @param {Array<Object>} verses - Array of verse objects from API
 * @returns {string} Formatted verses
 */
export function formatVersesFromApi(verses) {
  return verses
    .map((verse) => {
      const chapter = verse.chapter ?? "";
      const number = verse.verse ?? "";
      const cleaned = typeof verse.text === "string" ? verse.text.replace(/\s+/g, " ").trim() : "";
      const label = chapter ? `${chapter}:${number}` : `${number}`;
      return `${label}. ${cleaned}`;
    })
    .join("\n");
}

/**
 * Handle offline scripture requests using local sample data
 * @param {Object} request - Scripture request
 * @param {Object} sampleDb - Local scripture database
 * @returns {string} Formatted scripture or error message
 */
export function handleScriptureRequestOffline(request, sampleDb) {
  const dbEntry = sampleDb[request.canonical];
  if (!dbEntry) {
    return `No scripture data found for ${request.canonical}.`;
  }

  const chapterData = dbEntry.chapters[request.chapter];
  if (!chapterData) {
    return `${request.canonical} ${request.chapter} is not available in the local sample data yet.`;
  }

  const targetLanguage = request.language === "ko" ? "ko" : "en";

  if (!request.verseStart) {
    return formatEntireChapter(request, chapterData, targetLanguage);
  }

  const start = request.verseStart;
  const end = request.verseEnd ?? request.verseStart;
  const verses = [];

  for (let verse = start; verse <= end; verse += 1) {
    const verseData = chapterData[verse];
    if (!verseData) continue;
    const text = verseData[targetLanguage] ?? verseData.en;
    verses.push(`${verse}. ${text}`);
  }

  if (verses.length === 0) {
    return `No verses matched ${request.canonical} ${request.chapter}:${request.verseStart}${request.verseEnd ? "-" + request.verseEnd : ""} in the local sample.`;
  }

  return verses.join("\n");
}

/**
 * Format an entire chapter
 * @param {Object} request - Scripture request
 * @param {Object} chapterData - Chapter data object
 * @param {string} targetLanguage - Target language code (en/ko)
 * @returns {string} Formatted chapter
 */
export function formatEntireChapter(request, chapterData, targetLanguage) {
  const verses = Object.keys(chapterData)
    .map((key) => Number.parseInt(key, 10))
    .sort((a, b) => a - b)
    .map((verseNumber) => {
      const verseData = chapterData[verseNumber];
      const text = verseData[targetLanguage] ?? verseData.en;
      return `${verseNumber}. ${text}`;
    });

  if (verses.length === 0) {
    return `${request.canonical} ${request.chapter} is empty in the sample dataset.`;
  }

  return verses.join("\n");
}
