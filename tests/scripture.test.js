import { describe, it, expect } from 'vitest';
import {
  parseScriptureQuery,
  formatVersesFromApi,
  handleScriptureRequestOffline,
  formatEntireChapter,
} from '../lib/scripture.js';

const BOOK_ALIASES = {
  acts: { canonical: 'Acts', language: 'en' },
  사도행전: { canonical: 'Acts', language: 'ko' },
  행: { canonical: 'Acts', language: 'ko' },
  john: { canonical: 'John', language: 'en' },
  요한복음: { canonical: 'John', language: 'ko' },
  요: { canonical: 'John', language: 'ko' },
};

const SAMPLE_DB = {
  Acts: {
    chapters: {
      1: {
        8: {
          en: 'But you will receive power when the Holy Spirit has come upon you, and you will be my witnesses in Jerusalem and in all Judea and Samaria, and to the end of the earth. (ESV)',
          ko: '오직 성령이 너희에게 임하시면 너희가 권능을 받고 예루살렘과 온 유대와 사마리아와 땅 끝까지 이르러 내 증인이 되리라 하시니라. (KRV)',
        },
      },
    },
  },
  John: {
    chapters: {
      3: {
        16: {
          en: 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life. (ESV)',
          ko: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라. (KRV)',
        },
        17: {
          en: 'For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him. (ESV)',
          ko: '하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요 그로 말미암아 세상이 구원을 받게 하려 하심이라. (KRV)',
        },
      },
    },
  },
};

describe('parseScriptureQuery', () => {
  it('should parse book and chapter', () => {
    const result = parseScriptureQuery('John 3', BOOK_ALIASES);
    expect(result).toEqual({
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: null,
      verseEnd: null,
    });
  });

  it('should parse single verse', () => {
    const result = parseScriptureQuery('John 3:16', BOOK_ALIASES);
    expect(result).toEqual({
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    });
  });

  it('should parse verse range', () => {
    const result = parseScriptureQuery('John 3:16-18', BOOK_ALIASES);
    expect(result).toEqual({
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });
  });

  it('should handle Korean book names', () => {
    const result = parseScriptureQuery('요한복음 3:16', BOOK_ALIASES);
    expect(result).toEqual({
      canonical: 'John',
      language: 'ko',
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    });
  });

  it('should handle Korean abbreviations', () => {
    const result = parseScriptureQuery('요 3:16', BOOK_ALIASES);
    expect(result).toEqual({
      canonical: 'John',
      language: 'ko',
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    });
  });

  it('should return null for invalid input', () => {
    expect(parseScriptureQuery('invalid', BOOK_ALIASES)).toBeNull();
    expect(parseScriptureQuery('xyz 3:16', BOOK_ALIASES)).toBeNull();
    expect(parseScriptureQuery('', BOOK_ALIASES)).toBeNull();
  });

  it('should handle case insensitive book names', () => {
    const result = parseScriptureQuery('JOHN 3', BOOK_ALIASES);
    expect(result.canonical).toBe('John');
  });

  it('should handle whitespace variations', () => {
    const result = parseScriptureQuery('  John   3  ', BOOK_ALIASES);
    expect(result).not.toBeNull();
    expect(result.canonical).toBe('John');
  });

  it('should parse Acts references', () => {
    const result = parseScriptureQuery('Acts 1:8', BOOK_ALIASES);
    expect(result).toEqual({
      canonical: 'Acts',
      language: 'en',
      chapter: 1,
      verseStart: 8,
      verseEnd: null,
    });
  });
});

describe('formatVersesFromApi', () => {
  it('should format single verse', () => {
    const verses = [
      {
        book: 'John',
        chapter: 3,
        verse: 16,
        text: 'For God so loved the world...',
      },
    ];
    const result = formatVersesFromApi(verses);
    expect(result).toBe('3:16. For God so loved the world...');
  });

  it('should format multiple verses', () => {
    const verses = [
      { book: 'John', chapter: 3, verse: 16, text: 'Verse 16' },
      { book: 'John', chapter: 3, verse: 17, text: 'Verse 17' },
    ];
    const result = formatVersesFromApi(verses);
    expect(result).toContain('3:16. Verse 16');
    expect(result).toContain('3:17. Verse 17');
    expect(result).toContain('\n');
  });

  it('should normalize whitespace in verse text', () => {
    const verses = [
      {
        book: 'John',
        chapter: 3,
        verse: 16,
        text: 'For   God   so    loved   the   world...',
      },
    ];
    const result = formatVersesFromApi(verses);
    expect(result).toBe('3:16. For God so loved the world...');
  });

  it('should handle verses without chapter', () => {
    const verses = [
      { verse: 1, text: 'First verse' },
    ];
    const result = formatVersesFromApi(verses);
    expect(result).toBe('1. First verse');
  });

  it('should handle empty verses array', () => {
    expect(formatVersesFromApi([])).toBe('');
  });
});

describe('handleScriptureRequestOffline', () => {
  it('should return verse for valid request', () => {
    const request = {
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('For God so loved the world');
  });

  it('should handle verse range', () => {
    const request = {
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('16.');
    expect(result).toContain('17.');
  });

  it('should return Korean translation if available', () => {
    const request = {
      canonical: 'John',
      language: 'ko',
      chapter: 3,
      verseStart: 16,
      verseEnd: null,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('하나님이');
  });

  it('should format entire chapter if no verse specified', () => {
    const request = {
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: null,
      verseEnd: null,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('16.');
    expect(result).toContain('17.');
  });

  it('should return error message for non-existent book', () => {
    const request = {
      canonical: 'Nonexistent',
      language: 'en',
      chapter: 1,
      verseStart: 1,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('No scripture data found');
  });

  it('should return error message for non-existent chapter', () => {
    const request = {
      canonical: 'John',
      language: 'en',
      chapter: 99,
      verseStart: null,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('not available');
  });

  it('should return error message for non-existent verse', () => {
    const request = {
      canonical: 'John',
      language: 'en',
      chapter: 3,
      verseStart: 999,
    };
    const result = handleScriptureRequestOffline(request, SAMPLE_DB);
    expect(result).toContain('No verses matched');
  });
});

describe('formatEntireChapter', () => {
  it('should format all verses in a chapter', () => {
    const chapterData = SAMPLE_DB.John.chapters[3];
    const request = {
      canonical: 'John',
      chapter: 3,
    };
    const result = formatEntireChapter(request, chapterData, 'en');
    expect(result).toContain('16.');
    expect(result).toContain('17.');
    expect(result).toContain('For God so loved the world');
  });

  it('should format verses in order', () => {
    const chapterData = SAMPLE_DB.John.chapters[3];
    const request = {
      canonical: 'John',
      chapter: 3,
    };
    const result = formatEntireChapter(request, chapterData, 'en');
    const lines = result.split('\n');
    // First verse should come before second (as numbers)
    const verseNumbers = lines.map(line => Number.parseInt(line.split('.')[0], 10));
    expect(verseNumbers[0]).toBeLessThan(verseNumbers[1]);
  });

  it('should use Korean translation if specified', () => {
    const chapterData = SAMPLE_DB.John.chapters[3];
    const request = {
      canonical: 'John',
      chapter: 3,
    };
    const result = formatEntireChapter(request, chapterData, 'ko');
    expect(result).toContain('하나님이');
  });

  it('should fallback to English if Korean unavailable', () => {
    const chapterData = {
      1: {
        en: 'English text',
      },
    };
    const request = {
      canonical: 'Test',
      chapter: 1,
    };
    const result = formatEntireChapter(request, chapterData, 'ko');
    expect(result).toContain('English text');
  });
});
