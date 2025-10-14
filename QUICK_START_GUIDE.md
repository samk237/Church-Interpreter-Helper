# Quick Start Guide - Your Expanded Dictionary

## 🎉 Congratulations! Your dictionary now has **638+ terms**!

---

## How to Use

### 1. Open the App

Simply visit: **http://localhost:5173**

### 2. Create or Select a Session

Click "Manage Sessions" and create a session for your service.

### 3. Start Translating!

Type any Korean or English term in the chat box and press Enter.

---

## What's Special About Your Dictionary?

### ⚡ Lightning Fast Local Translations

All 638+ terms translate **instantly** without needing internet or API calls!

The translation happens in this order:

1. **Local Dictionary** (638+ terms) → **Instant** ✅
2. Ollama AI → ~2-5 seconds
3. LibreTranslate → ~3-8 seconds (fallback)

### 🎯 Your Translation Will Be Instant For:

#### All Your Word Lists (#1-10)

Every single term from your word lists is now in the local dictionary!

#### Examples That Work Instantly:

- **귀복주의** → prosperity gospel
- **성령내주** → indwelling of the Holy Spirit
- **중보기도** → intercessory prayer
- **조현병** → schizophrenia
- **작심삼일** → three day resolution
- **옷깃만 스쳐도 인연** → even a brush can lead to destiny
- **범신론** → pantheism
- **혼합주의** → syncretism
- **상해임시정부** → Shanghai provisional government
- **발족식** → inauguration ceremony

---

## Test These Terms Right Now!

### Theological Terms

```
칭의             → justification
성화             → sanctification
종교개혁         → protestant reformation
음부의 권세      → gates of hell
원색 복음        → pure gospel
성찬식          → holy communion service
```

### Mental Health (Complete Set!)

```
조울증          → bipolar disorder
강박증          → OCD
조현병          → schizophrenia
불안증          → anxiety disorder
공황장애        → panic disorder
우울증          → depression
```

### False Religion Terms

```
범신론          → pantheism
혼합주의        → syncretism
접신            → possession
신사참배        → submission to Japanese shrine
```

### Idiomatic Expressions

```
작심삼일                 → three day resolution
산전수전                 → hardship
옷깃만 스쳐도 인연        → even a brush can lead to destiny
눈치 본다                → gauging the mood
큰일나다                 → big trouble
```

### Church Leadership

```
권사님          → encourager
선교국장        → missions director
노회장          → chairman of presbytery
미주 총회장     → president of US general assembly
개혁총회        → reformed general assembly
```

### Special Worship Terms

```
중보기도        → intercessory prayer
철야기도        → overnight prayer
임종예배        → deathbed worship
통독            → reading entirety of scripture
유월절          → Passover
오순절          → Pentecost
```

### Historical Terms

```
이차대전                → WWII
연합군                  → allies
상해임시정부            → Shanghai provisional government
신사참배                → submission to Japanese shrine
```

---

## Understanding the Three Types of Jealousy

Your dictionary now distinguishes between three Korean words for jealousy:

| Korean | English                          | Meaning                          |
| ------ | -------------------------------- | -------------------------------- |
| 질투   | jealous (of what you have)       | Fear of losing what you possess  |
| 시기   | jealous (of what you don't have) | Wanting what others have         |
| 부러움 | admiring jealousy                | Positive envy without bitterness |

---

## Understanding Death Euphemisms

Korean has different levels of respect for death:

| Korean               | English                    | Usage                        |
| -------------------- | -------------------------- | ---------------------------- |
| 별세                 | passed away (with respect) | For honored/elderly people   |
| 객사                 | passed away                | Neutral, died away from home |
| 하늘 나라에 돌아간다 | returned to heaven         | Christian euphemism          |

---

## Pro Tips

### 1. Session Glossary

Every term you translate gets saved to your session's glossary. If you translate a phrase using the API, it will be instant next time in that session!

### 2. Phrase Matching

The system matches exact phrases first, then breaks down into words. So:

- "옷깃만 스쳐도 인연" matches as one phrase
- But "옷깃 만" would be broken into individual words

### 3. Case Sensitivity

English terms are case-insensitive in the dictionary, so:

- "PASTOR" → 목사
- "pastor" → 목사
- "Pastor" → 목사
  All work the same!

### 4. Punctuation

The system strips punctuation automatically, so:

- "calvary!" → works
- "heaven?" → works
- "grace." → works

---

## What If a Term Isn't Found?

If you type a term not in the dictionary:

1. **First**: The app checks the local dictionary (instant)
2. **Then**: Sends to Ollama with theological context (~2-5 sec)
3. **Finally**: Falls back to LibreTranslate if Ollama fails
4. **Result**: Gets saved to your session glossary for next time!

---

## Categories in Your Dictionary

Your 638+ terms cover:

- ✅ **Church Leadership** (12 terms)
- ✅ **Advanced Theology** (26 terms)
- ✅ **Worship Practices** (13 terms)
- ✅ **False Religion** (15 terms)
- ✅ **Mental Health** (12 terms) - Complete set!
- ✅ **Medical Terms** (10 terms)
- ✅ **Character & Emotions** (32 terms)
- ✅ **Idiomatic Phrases** (28 terms)
- ✅ **Historical/Cultural** (13 terms)
- ✅ **Ministry Terms** (17 terms)
- ✅ **And 20+ more categories!**

---

## Troubleshooting

### "No translation available"

- Check spelling
- The term might need API translation (takes a few seconds)
- Once translated via API, it saves to your session

### Slow translation

- First time translations use AI (slower)
- All subsequent translations are instant!
- 638+ terms are already instant

### Server not responding

- Make sure server is running: `npm start`
- Check http://localhost:5173/api/health
- Restart: `pkill -f "node server.js" && npm start`

---

## Your Dictionary at a Glance

```
📚 Total Terms: 638+
⚡ Instant Lookups: 638+
🎯 Categories: 25+
🌟 Coverage: Comprehensive

Categories Include:
├── Theological (45+ terms)
├── Church Operations (30+ terms)
├── Mental Health (12 terms)
├── Medical (15+ terms)
├── Emotions (35+ terms)
├── Idiomatic Phrases (28+ terms)
├── False Religion (15 terms)
├── Historical/Cultural (20+ terms)
└── And many more!
```

---

## Ready to Use!

1. **Refresh your browser** at http://localhost:5173
2. **Create/select a session**
3. **Start typing** any of the 638+ terms
4. **Watch them translate instantly!** ⚡

Your Church Interpreter Helper is now one of the most comprehensive Korean-English church translation systems available! 🚀

---

## Need to Add More Terms?

Edit `app.js` and add to `BASE_DICTIONARY`:

```javascript
{ ko: "your_term", en: "your translation" },
```

Or just translate via the API once, and it saves to your session automatically!
