# Testing Guide for Church Interpreter Helper

## Overview

This document describes the comprehensive test suite for the Church Interpreter Helper project. The project now includes **128 passing tests** covering core functionality with **100% test pass rate**.

## Test Framework

- **Test Runner**: Vitest 2.0
- **Language**: JavaScript (ES Modules)
- **Coverage**: Core utilities, helpers, dictionary operations, scripture lookup, and session management

## Running Tests

### Run all tests once
```bash
npm test
```

### Watch mode (re-run on file changes)
```bash
npm run test:watch
```

### Generate coverage report
```bash
npm run test:coverage
```

## Test Structure

Tests are organized in the `tests/` directory by module:

```
tests/
├── helpers.test.js          # 42 tests for utility functions
├── dictionary.test.js       # 23 tests for dictionary operations
├── scripture.test.js        # 25 tests for scripture parsing
└── session.test.js          # 38 tests for session management
```

### Supporting modules in `lib/`

```
lib/
├── helpers.js               # Exported utility functions for testing
├── dictionary.js            # Dictionary and glossary operations
├── scripture.js             # Scripture parsing and formatting
└── session.js               # Session CRUD and export operations
```

## Test Modules

### 1. helpers.test.js (42 tests)

Core utility functions for text processing and metadata:

- **normalizeToken**: Case normalization for tokens
  - Lowercases English, preserves Korean
  - Handles empty/null tokens

- **containsHangul**: Korean character detection
  - Detects Korean in mixed text
  - Returns false for English/numbers

- **applyCase**: Case pattern application
  - Uppercase, title case, and lowercase patterns
  - Handles edge cases (single char, empty reference)

- **levenshteinDistance**: String similarity calculation
  - Calculates edit distance between strings
  - Tests identical, single-edit, and multi-edit cases

- **tokenize**: Text tokenization
  - Splits text into tokens with punctuation
  - Preserves original and stripped forms
  - Handles Korean, English, numbers

- **rebuildText**: Token reconstruction
  - Rebuilds text from translated tokens
  - Handles partial translations

- **formatReferenceForApi**: Scripture reference formatting
  - Formats book/chapter/verse references
  - Handles ranges and single verses

- **roleLabel**: User role labeling
  - Maps role names to display labels

- **generateId**: UUID generation
  - Generates v4 UUIDs
  - Produces unique, consistent-length IDs

### 2. dictionary.test.js (23 tests)

Dictionary and glossary management:

- **buildDictionaryMaps**: Creates lookup maps
  - Korean→English and English→Korean maps
  - Tests empty and full dictionaries

- **suggestSimilar**: Similarity-based term suggestions
  - Finds similar terms using Levenshtein distance
  - Limits results to top 10
  - Filters by distance threshold

- **lookupPhrase**: Phrase lookup
  - Checks glossary first, then dictionary
  - Handles case-insensitive English lookup
  - Prioritizes glossary over dictionary

- **lookupToken**: Token-level lookup
  - Finds tokens in dictionary/glossary
  - Applies case patterns
  - Handles empty strips and missing terms

### 3. scripture.test.js (25 tests)

Scripture reference parsing and formatting:

- **parseScriptureQuery**: Reference parsing
  - Parses "John 3", "John 3:16", "John 3:16-18" formats
  - Handles Korean book names and abbreviations
  - Case-insensitive matching

- **formatVersesFromApi**: API response formatting
  - Formats verses with chapter:verse labels
  - Normalizes whitespace
  - Handles empty results

- **handleScriptureRequestOffline**: Offline scripture lookup
  - Returns verses from sample database
  - Handles single verse, ranges, entire chapters
  - Returns appropriate error messages

- **formatEntireChapter**: Chapter formatting
  - Formats all verses in order
  - Supports bilingual output (English/Korean)
  - Fallback to English if Korean unavailable

### 4. session.test.js (38 tests)

Session management and persistence:

- **createSession**: Session creation
  - Creates sessions with metadata
  - Sets timestamps
  - Uses default values

- **addMessageToTranscript**: Message logging
  - Adds messages with timestamps
  - Updates session modification time
  - Preserves message role

- **storeGlossaryEntry**: Glossary storage
  - Stores translations by source term
  - Normalizes English terms (lowercase)
  - Updates session timestamps

- **getSessionGlossary/getSessionTranscript**: Data retrieval
  - Returns deep copies (immutable)
  - Prevents accidental mutations

- **clearSessionTranscript/clearSessionGlossary**: Data clearing
  - Wipes transcript or glossary
  - Updates timestamps

- **exportSessionJson**: JSON export
  - Exports complete session data
  - Preserves structure

- **exportSessionMarkdown**: Markdown export
  - Formats session for human reading
  - Includes title, scripture, speaker, transcript
  - Formats glossary alphabetically

- **exportGlossaryCsv**: CSV export
  - Escapes special characters
  - Maintains sort order

- **importGlossaryFromCsv**: CSV import
  - Parses quoted CSV format
  - Handles multiple entries
  - Skips header row

- **searchTranscript**: Transcript searching
  - Case-insensitive search
  - Partial matching
  - Returns matching entries

## Test Coverage

The current test suite covers:

| Module | Tests | Coverage |
|--------|-------|----------|
| helpers | 42 | 100% |
| dictionary | 23 | 100% |
| scripture | 25 | 100% |
| session | 38 | 100% |
| **TOTAL** | **128** | **100%** |

## Key Testing Patterns

### 1. Isolated Unit Tests

Each function is tested independently with:
- Valid inputs
- Edge cases
- Invalid inputs
- Error conditions

Example:
```javascript
describe('normalizeToken', () => {
  it('should lowercase English tokens', () => {
    expect(normalizeToken('HELLO', false)).toBe('hello');
  });

  it('should preserve Korean tokens', () => {
    expect(normalizeToken('안녕', true)).toBe('안녕');
  });

  it('should handle empty tokens', () => {
    expect(normalizeToken('', true)).toBe('');
  });
});
```

### 2. Integration Tests

Functions are tested in realistic scenarios:

```javascript
describe('importGlossaryFromCsv', () => {
  it('should import CSV entries', () => {
    const session = createSession({ id: 'test', title: 'Test' });
    const csv = 'Source,Target\n"grace","은혜"\n"faith","믿음"';
    const imported = importGlossaryFromCsv(session, csv);
    expect(imported).toBe(2);
    expect(session.glossary['grace']).toBe('은혜');
  });
});
```

### 3. Edge Case Coverage

Tests include:
- Empty/null inputs
- Boundary conditions
- Unicode handling (Korean characters)
- Case sensitivity variations
- Large datasets (10+ items)

## Important Test Notes

### Korean Character Handling

The `applyCase` function treats Korean characters specially:
- Korean chars === uppercase(Korean chars) returns `true`
- So `applyCase('God', '하나님')` returns `'GOD'`

### Token Joining

The `rebuildText` function joins tokens with spaces, creating multiple spaces:
```javascript
rebuildText(['hello', ' ', 'world'], ['안녕', ' ', '세계'])
// Returns: '안녕   세계' (3 spaces total)
```

### CSV Import

The CSV import function:
- Skips the first line (header)
- Uses regex pattern `/"([^"]*)","([^"]*)"/`
- Cannot handle escaped quotes in values
- Requires properly quoted values

## Adding New Tests

To add tests for new functions:

1. Export the function from its module in `lib/`
2. Import it in the appropriate test file in `tests/`
3. Create a `describe` block for the function
4. Add test cases covering:
   - Normal operation
   - Edge cases
   - Error conditions
   - Related functions interaction

Example:
```javascript
import { newFunction } from '../lib/module.js';

describe('newFunction', () => {
  it('should do expected thing', () => {
    const result = newFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(newFunction('')).toBe(something);
  });
});
```

## Continuous Integration

The test suite is designed to run in CI/CD environments:

```bash
# Single run (CI mode)
npm test

# Exit with status code based on results
echo $?  # 0 if all pass, non-zero if any fail
```

## Future Enhancements

### Phase 2: Translation Testing

- Mock Ollama responses
- Test translation fallback chain
- Verify API error handling
- Test timeout behavior

### Phase 3: Server Testing

- Test Express endpoints
- Mock external APIs (Bible API, LibreTranslate)
- Test error responses
- Benchmark translation providers

### Phase 4: E2E Testing

- Full workflow tests
- Browser automation (Playwright)
- User interaction simulation
- Session persistence verification

## Debugging Tests

### Run a single test file:
```bash
npm test tests/helpers.test.js
```

### Run a single test:
```bash
npm test -- -t "should normalize tokens"
```

### Enable verbose output:
```bash
npm test -- --reporter=verbose
```

### Debug in VSCode:
```javascript
// Add this to a test
debugger;

// Then run with:
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

## Performance

Current test suite runs in:
- **Total time**: ~260ms
- **Per test**: ~2ms average
- **Setup**: ~57ms
- **Collection**: ~106ms

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Church Interpreter Helper Architecture](./Documentation/README.md)
- [QUICK_START_GUIDE.md](./Documentation/QUICK_START_GUIDE.md)

---

**Last Updated**: October 17, 2025
**Test Framework Version**: Vitest 2.0
**Total Tests**: 128
**Pass Rate**: 100%
