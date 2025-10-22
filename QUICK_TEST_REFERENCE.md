# Quick Test Reference

## Run Tests

```bash
# All tests (once)
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

## Test Results

```
✓ tests/scripture.test.js (25 tests)
✓ tests/helpers.test.js (42 tests)
✓ tests/dictionary.test.js (23 tests)
✓ tests/session.test.js (38 tests)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Total: 128 tests, 100% passing
```

## What's Tested

| Module | Tests | What |
|--------|-------|------|
| **helpers** | 42 | Tokenize, language detection, case handling, distance calculation, UUID |
| **dictionary** | 23 | Lookups, suggestions, glossary management |
| **scripture** | 25 | Parse references, format verses, offline lookup |
| **session** | 38 | Create/manage sessions, export JSON/Markdown/CSV, search, import |

## Key Functions Tested

### helpers.js
- `normalizeToken()` - Lowercase English, keep Korean
- `containsHangul()` - Detect Korean characters
- `applyCase()` - Apply case pattern from reference
- `levenshteinDistance()` - String similarity
- `tokenize()` - Split text into tokens
- `rebuildText()` - Join translated tokens
- `formatReferenceForApi()` - Format scripture reference
- `roleLabel()` - Convert role name to label
- `generateId()` - Generate UUID v4

### dictionary.js
- `buildDictionaryMaps()` - Create Ko→En & En→Ko maps
- `suggestSimilar()` - Find similar terms
- `lookupPhrase()` - Find exact phrases
- `lookupToken()` - Find token with case handling

### scripture.js
- `parseScriptureQuery()` - Parse "John 3:16" format
- `formatVersesFromApi()` - Format API response
- `handleScriptureRequestOffline()` - Lookup in sample data
- `formatEntireChapter()` - Format all verses

### session.js
- `createSession()` - New session with metadata
- `addMessageToTranscript()` - Log message
- `storeGlossaryEntry()` - Store translation
- `exportSessionJson()` - Export as JSON
- `exportSessionMarkdown()` - Export as Markdown
- `exportGlossaryCsv()` - Export glossary as CSV
- `importGlossaryFromCsv()` - Import from CSV
- `searchTranscript()` - Search messages
- `clearSessionTranscript()` - Wipe transcript
- `clearSessionGlossary()` - Wipe glossary
- `deleteGlossaryEntry()` - Remove one entry
- `getSessionGlossary()` - Get copy of glossary
- `getSessionTranscript()` - Get copy of transcript

## File Locations

```
Church Interpreter Helper/
├── lib/                      # Reusable modules
│   ├── helpers.js           # ← 14 utility functions
│   ├── dictionary.js        # ← 5 glossary functions
│   ├── scripture.js         # ← 4 parsing functions
│   └── session.js           # ← 15 session functions
│
├── tests/                   # Test suites
│   ├── helpers.test.js      # ← 42 tests
│   ├── dictionary.test.js   # ← 23 tests
│   ├── scripture.test.js    # ← 25 tests
│   └── session.test.js      # ← 38 tests
│
├── vitest.config.js         # Test configuration
├── package.json             # npm scripts & dependencies
├── TESTING.md              # Full testing guide
├── TEST_SUMMARY.md         # Implementation summary
└── QUICK_TEST_REFERENCE.md # This file
```

## Adding a New Test

1. Identify the function to test in `lib/`
2. Add to appropriate test file in `tests/`
3. Follow this pattern:

```javascript
describe('functionName', () => {
  it('should do X', () => {
    const result = functionName('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(functionName('')).toBe(something);
  });
});
```

4. Run tests: `npm run test:watch`

## Common Test Patterns

### Exact matching
```javascript
expect(result).toBe('expected string');
```

### Array/object matching
```javascript
expect(result).toEqual([1, 2, 3]);
expect(result).toEqual({ key: 'value' });
```

### Type checking
```javascript
expect(result).toHaveLength(5);
expect(Array.isArray(result)).toBe(true);
```

### Regex matching
```javascript
expect(result).toMatch(/[Gg]od/);
```

### Existence checks
```javascript
expect(result).toBeDefined();
expect(result).not.toBeNull();
expect(result.glossary['term']).toBe('translation');
```

## Debugging Tests

### Run single file
```bash
npm test tests/helpers.test.js
```

### Run single test
```bash
npm test -- -t "should normalize tokens"
```

### Verbose output
```bash
npm test -- --reporter=verbose
```

## Important Notes

### Korean Characters
- `'하나님' === '하나님'.toUpperCase()` returns `true`
- So `applyCase('God', '하나님')` returns `'GOD'`

### Token Joining
- `rebuildText()` joins with spaces
- Multiple token spaces create multiple output spaces
- `['hello', ' ', 'world']` → `'hello   world'` (3 spaces)

### CSV Import
- Header row is skipped
- Requires quoted values: `"term","translation"`
- Cannot handle escaped quotes in values

## Resources

- **[TESTING.md](./TESTING.md)** - Comprehensive guide with all details
- **[TEST_SUMMARY.md](./TEST_SUMMARY.md)** - What was implemented and why
- **[Vitest Docs](https://vitest.dev/)** - Official testing framework documentation

---

**Status**: 128/128 tests passing ✓
**Framework**: Vitest 2.0
**Last Updated**: October 17, 2025
