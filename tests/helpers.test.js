import { describe, it, expect } from 'vitest';
import {
  normalizeToken,
  containsHangul,
  applyCase,
  levenshteinDistance,
  tokenize,
  rebuildText,
  formatReferenceForApi,
  roleLabel,
  generateId,
} from '../lib/helpers.js';

describe('normalizeToken', () => {
  it('should lowercase English tokens', () => {
    expect(normalizeToken('HELLO', false)).toBe('hello');
    expect(normalizeToken('Hello', false)).toBe('hello');
  });

  it('should preserve Korean tokens', () => {
    expect(normalizeToken('안녕', true)).toBe('안녕');
    expect(normalizeToken('하나님', true)).toBe('하나님');
  });

  it('should handle empty tokens', () => {
    expect(normalizeToken('', true)).toBe('');
    expect(normalizeToken('', false)).toBe('');
    expect(normalizeToken(null, false)).toBe('');
  });
});

describe('containsHangul', () => {
  it('should detect Korean characters', () => {
    expect(containsHangul('안녕하세요')).toBe(true);
    expect(containsHangul('하나님')).toBe(true);
    expect(containsHangul('기도')).toBe(true);
  });

  it('should return false for English text', () => {
    expect(containsHangul('hello')).toBe(false);
    expect(containsHangul('Hello World')).toBe(false);
  });

  it('should detect Hangul in mixed text', () => {
    expect(containsHangul('Hello 안녕')).toBe(true);
    expect(containsHangul('기도 Prayer')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(containsHangul('')).toBe(false);
  });

  it('should handle numbers and punctuation', () => {
    expect(containsHangul('12345')).toBe(false);
    expect(containsHangul('!@#$%')).toBe(false);
    expect(containsHangul('기도 123')).toBe(true);
  });
});

describe('applyCase', () => {
  it('should apply all uppercase', () => {
    expect(applyCase('hello', 'WORLD')).toBe('HELLO');
    expect(applyCase('grace', 'GRACE')).toBe('GRACE');
  });

  it('should apply title case', () => {
    expect(applyCase('hello', 'World')).toBe('Hello');
    expect(applyCase('grace', 'God')).toBe('Grace');
  });

  it('should preserve lowercase', () => {
    // applyCase checks if reference is fully uppercase. 'world' is not fully uppercase, so checks first char
    // 'world'[0] = 'w' which is not uppercase, so returns source.toLowerCase() implicitly (no lowercase check)
    // Actually it just returns source as-is in the else case
    expect(applyCase('HELLO', 'world')).toBe('HELLO'); // No match, returns as-is
    expect(applyCase('GRACE', 'faith')).toBe('GRACE');
  });

  it('should handle single character', () => {
    expect(applyCase('a', 'B')).toBe('A');
    expect(applyCase('A', 'b')).toBe('A'); // 'b' is not uppercase, so returns as-is
  });

  it('should handle empty reference', () => {
    // Empty string is === to its uppercase form '', so returns source.toUpperCase()
    expect(applyCase('hello', '')).toBe('HELLO');
  });
});

describe('levenshteinDistance', () => {
  it('should calculate distance between identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
    expect(levenshteinDistance('grace', 'grace')).toBe(0);
  });

  it('should calculate distance for single character insertion', () => {
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
    expect(levenshteinDistance('prayer', 'prayers')).toBe(1);
  });

  it('should calculate distance for single character deletion', () => {
    expect(levenshteinDistance('cats', 'cat')).toBe(1);
    expect(levenshteinDistance('prayers', 'prayer')).toBe(1);
  });

  it('should calculate distance for single character substitution', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    expect(levenshteinDistance('faith', 'faith')).toBe(0);
  });

  it('should calculate distance for multiple edits', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
  });

  it('should handle empty strings', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', '')).toBe(0);
  });
});

describe('tokenize', () => {
  it('should tokenize simple English text', () => {
    const result = tokenize('hello world');
    expect(result).toHaveLength(2);
    expect(result[0].original).toBe('hello');
    expect(result[0].strip).toBe('hello');
    expect(result[1].original).toBe('world');
    expect(result[1].strip).toBe('world');
  });

  it('should tokenize text with punctuation', () => {
    const result = tokenize('Hello, world!');
    expect(result.length).toBeGreaterThan(2);
    const strippedTokens = result.map(t => t.strip).filter(s => s);
    expect(strippedTokens).toContain('Hello');
    expect(strippedTokens).toContain('world');
  });

  it('should tokenize Korean text', () => {
    const result = tokenize('하나님 기도');
    expect(result).toHaveLength(2);
    expect(result[0].strip).toBe('하나님');
    expect(result[1].strip).toBe('기도');
  });

  it('should preserve original form with punctuation', () => {
    const result = tokenize('(hello)');
    // Punctuation gets tokenized separately: '(' , 'hello', ')'
    expect(result.map(t => t.strip).join('')).toBe('hello');
    expect(result.some(t => t.strip === 'hello')).toBe(true);
  });

  it('should handle numbers', () => {
    const result = tokenize('3 John 3:16');
    expect(result.length).toBeGreaterThan(2);
    expect(result.map(t => t.strip)).toContain('3');
    expect(result.map(t => t.strip)).toContain('John');
    expect(result.map(t => t.strip)).toContain('16');
  });

  it('should handle empty string', () => {
    expect(tokenize('')).toHaveLength(0);
    expect(tokenize('   ')).toHaveLength(0);
  });

  it('should handle mixed case', () => {
    const result = tokenize("don't");
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(t => t.original === "don't")).toBe(true);
  });
});

describe('rebuildText', () => {
  it('should rebuild text with all translations', () => {
    const tokens = [
      { original: 'hello', strip: 'hello' },
      { original: ' ', strip: '' },
      { original: 'world', strip: 'world' },
    ];
    const translated = ['안녕', ' ', '세계'];
    // rebuildText joins with spaces, so space tokens become spaces too
    expect(rebuildText(tokens, translated)).toBe('안녕   세계');
  });

  it('should preserve original words without translation', () => {
    const tokens = [
      { original: 'hello', strip: 'hello' },
      { original: ' ', strip: '' },
      { original: 'unknown', strip: 'unknown' },
    ];
    const translated = ['안녕', ' ', undefined];
    expect(rebuildText(tokens, translated)).toBe('안녕   unknown');
  });

  it('should handle empty tokens', () => {
    expect(rebuildText([], [])).toBe('');
  });

  it('should handle partial translations', () => {
    const tokens = [
      { original: 'God', strip: 'God' },
      { original: ' ', strip: '' },
      { original: 'is', strip: 'is' },
      { original: ' ', strip: '' },
      { original: 'grace', strip: 'grace' },
    ];
    const translated = ['하나님', ' ', 'is', ' ', '은혜'];
    expect(rebuildText(tokens, translated)).toBe('하나님   is   은혜');
  });
});

describe('formatReferenceForApi', () => {
  it('should format book and chapter', () => {
    const result = formatReferenceForApi({
      canonical: 'John',
      chapter: 3,
    });
    expect(result).toBe('John 3');
  });

  it('should format single verse', () => {
    const result = formatReferenceForApi({
      canonical: 'John',
      chapter: 3,
      verseStart: 16,
    });
    expect(result).toBe('John 3:16');
  });

  it('should format verse range', () => {
    const result = formatReferenceForApi({
      canonical: 'John',
      chapter: 3,
      verseStart: 16,
      verseEnd: 18,
    });
    expect(result).toBe('John 3:16-18');
  });

  it('should handle book only', () => {
    const result = formatReferenceForApi({
      canonical: 'John',
    });
    expect(result).toBe('John');
  });

  it('should not add range if same verse', () => {
    const result = formatReferenceForApi({
      canonical: 'Acts',
      chapter: 2,
      verseStart: 38,
      verseEnd: 38,
    });
    expect(result).toBe('Acts 2:38');
  });
});

describe('roleLabel', () => {
  it('should label user role', () => {
    expect(roleLabel('user')).toBe('You');
  });

  it('should label assistant role', () => {
    expect(roleLabel('assistant')).toBe('Helper');
  });

  it('should label system role', () => {
    expect(roleLabel('system')).toBe('System');
  });

  it('should return unknown role as is', () => {
    expect(roleLabel('unknown')).toBe('unknown');
    expect(roleLabel('translator')).toBe('translator');
  });
});

describe('generateId', () => {
  it('should generate UUIDs in v4 format', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should generate consistent length IDs', () => {
    const id = generateId();
    expect(id.length).toBe(36); // UUID length with hyphens
  });
});
