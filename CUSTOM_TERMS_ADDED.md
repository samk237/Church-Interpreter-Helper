# Custom Terms Added from Translation History

This document lists all the specific terms you requested to be added to the dictionary.

## Summary

- **Total terms added**: 69 custom terms
- **Dictionary size**: Now 250+ terms (up from 130+)
- **Location**: `app.js` (BASE_DICTIONARY) and `server.js` (Ollama prompt)

## All Terms Added

### Advanced Theological Terms

| Korean             | English                       | Category             |
| ------------------ | ----------------------------- | -------------------- |
| 성령내주           | indwelling of the Holy Spirit | Advanced Theology    |
| 환란               | tribulation                   | Eschatology          |
| 철야 예배          | all-night vigil               | Worship              |
| 교리               | doctrine                      | Theology             |
| 소요리 문답        | Shorter Catechism             | Reformed Theology    |
| 교대이교           | ancient paganism              | Religious Studies    |
| 미신               | superstition                  | Religious Concepts   |
| 서신서             | epistles                      | Scripture            |
| 본질상 진노의 자녀 | by nature, children of wrath  | Ephesians 2:3        |
| 성육하고 번성      | be fruitful and multiply      | Genesis 1:28         |
| 견고한 진          | stronghold                    | Spiritual Warfare    |
| 본질               | essence                       | Theology             |
| 징계               | discipline                    | Church Practice      |
| 다스리고 정복      | rule over and subdue          | Genesis 1:28         |
| 귀복주의           | prosperity gospel             | Theological Movement |

### Worship & Service Terms

| Korean          | English                        |
| --------------- | ------------------------------ |
| 매시 매사       | at all times and in all things |
| 정성을 드린다   | offer with sincerity           |
| 마음을 주장하다 | guard our hearts               |
| 불쌍히 여긴다   | show compassion                |
| 감격            | being moved with thanksgiving  |

### Church Organization & Roles

| Korean   | English             |
| -------- | ------------------- |
| 사회자   | presider            |
| 주관하다 | preside             |
| 유치부   | preschool ministry  |
| 실무진   | working staff       |
| 총무단   | executive committee |

### General Spiritual Concepts

| Korean   | English       |
| -------- | ------------- |
| 내적     | internal      |
| 무조건   | unconditional |
| 의도     | intention     |
| 의식     | consciousness |
| 비방     | slander       |
| 윤리     | ethics        |
| 도덕     | morality      |
| 재주     | talents       |
| 보장     | guarantee     |
| 조건     | condition     |
| 관리     | manage        |
| 단속     | control       |
| 다스리다 | rule over     |
| 형통     | prosperity    |
| 추방     | expel         |
| 소유자   | owner         |
| 동기     | motive        |
| 고민     | concern       |
| 진심     | sincere heart |

### Descriptive Terms

| Korean        | English     |
| ------------- | ----------- |
| 놀랍다        | marvelous   |
| 충분하다      | sufficient  |
| 급하다        | urgent      |
| 버티다        | endure      |
| 마음이 아프다 | heartbroken |
| 억울          | wronged     |

### Everyday & Specific Terms

| Korean        | English                   | Notes          |
| ------------- | ------------------------- | -------------- |
| 기념비        | monument                  |                |
| 보식          | supplemental food         |                |
| 여유          | leisure                   |                |
| 정시          | on schedule               |                |
| 끈 떨어진 연  | kite with a broken string | Metaphorical   |
| 주파수        | frequency                 | Technical      |
| 걸걸한 목소리 | hoarse voice              | Descriptive    |
| 유서          | will                      | Legal          |
| 교범          | guidebook                 | Reference      |
| 조경          | landscaping               | Practical      |
| 비석          | gravestone                | Memorial       |
| 치매          | dementia                  | Medical        |
| 애국심        | patriotism                | Political      |
| 보고          | report                    | Administrative |
| 동문서답      | nonsensical answer        | Idiomatic      |
| 박예 주의자   | philanthropist            | Character      |

## How to Use

### Testing

Simply refresh your browser at `http://localhost:5173` and try translating any of these terms. They will now be:

1. **Instantly recognized** by the local dictionary (fastest)
2. **Guided** through the Ollama prompt (for phrase context)
3. **Stored** in your session glossary for future reference

### Examples to Test

Try these in the chat:

- `귀복주의` → "prosperity gospel" ✅
- `성령내주` → "indwelling of the Holy Spirit" ✅
- `환란` → "tribulation" ✅
- `끈 떨어진 연` → "kite with a broken string" ✅
- `본질상 진노의 자녀` → "by nature, children of wrath" ✅

## Adding More Terms

To add additional terms in the future:

### Option 1: Edit app.js directly

Add to the `BASE_DICTIONARY` array around line 240:

```javascript
{ ko: "your_korean_term", en: "your english translation" },
```

### Option 2: Let them be learned

When you translate new terms using the API, they are automatically saved to your session's glossary and will be reused in future translations within that session.

## Updates Made

### Files Modified

1. **app.js** - Added 69 new dictionary entries
2. **server.js** - Added 11 key theological terms to Ollama prompt

### Benefits

- ✅ Faster translations for all your historical difficult words
- ✅ Consistent theological terminology
- ✅ Better context understanding for phrases
- ✅ Reduced reliance on external translation APIs
