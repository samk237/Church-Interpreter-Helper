# Church Interpreter Helper

A Korean ↔ English companion for live church interpreting. It is **deterministic first**: your own word lists decide the answer, the same input always gives the same output, and anything that comes from machine translation is clearly labelled.

## Run it

```bash
npm install
npm start            # → http://localhost:5173
npm test             # 240+ tests, incl. every passage in your scripture lists
```

Optional: copy `.env.local.example` to `.env.local` to add an ESV API key or choose the machine-translation fallback.

## What it does

### Interpret tab
- **Instant matches while you type.** Glossary chips appear under the input before you press Enter. You can type 초성 too (`ㅈㅂㄱㄷ` → 중보기도).
- **Particles and conjugations are handled.** 중보기도를, 시기했다, 망설였다, and 애통하며 all find your entry.
- **Your original spellings still work.** 맹새 → 맹세, 귀복주의 → 기복주의. Close misspellings get "Did you mean" suggestions (compared letter by letter, using jamo).
- **Every meaning is kept.** When a word appears in several lists (감동, 마음이 아프다, 고민…), all meanings are shown, each with the list it came from.
- **English → Korean** works too (`jealous` → 질투 / 시기 / 시기하다).
- **Paste sermon notes or a bulletin** to see every glossary word in them, then press **Make flashcards from these** to study before the service.
- **Words that aren't in your lists** are shown as *Not in your word lists*, with "Did you mean" suggestions from your glossary. Below that, in a separate box labelled **🤖 AI — verify**, the local AI gives its translation. For English typos, the AI also offers a spelling "Did you mean" (providance → providence).
- **AI words are saved for review automatically.** Each AI answer for a single word is saved as *AI · unreviewed*, so you don't have to judge it mid-service. Next time it matches instantly, still flagged. You can tap **✓ Correct** or **Edit** right away, or review later: the **Glossary** tab shows a count badge, and its *🤖 AI — needs review* filter has ✓ (keep), Edit (fix), and ✗ (delete) for each word. Confirmed words become permanent. Unreviewed words stay out of flashcard decks.
- **Phrases up to about a sentence** (≤ 200 characters) are translated automatically. The AI translation of the sentence comes first, using your glossary terms, with *Your terms in this sentence* listed underneath. For longer text you get a button; for full paragraphs, use Claude.
- **English → Korean is automatic.** Type English and it does a reverse lookup in your lists, or uses the AI if the word isn't there.

### Scripture
Type references the way you'd jot them down:

`Jn 3:16` · `Mt 16:16 -20` · `1Jn 3:8` · `롬 10:17` · `요한복음 3장 16-18절` · `시편 23편` · `Rom 8:1-2, 28` · `Eph 6:10-18; Jas 4:7` · `Matthew 4:23-5:2` · `Jude 3`

All 66 books are supported, with English and Korean names and abbreviations. Verses appear side by side in English (ESV) and Korean (개역한글); you can switch to one language in ⚙ settings, with a Copy button. Lookups are instant and work offline, up to 200 verses per request.

| Bible | Source | License |
|---|---|---|
| 개역한글 (Korean, 1961) | bundled `data/bible/krv.json` | public domain |
| World English Bible (Updated) | bundled `data/bible/webu.json` — **emergency fallback only** (no key / no internet), labelled when used | public domain |
| **ESV** — the English shown | real ESV text fetched live from Crossway's official API (set `ESV_API_KEY`) | free for non-commercial use, with the required copyright notice (shown automatically) |

NIV, 개역개정, and BibleGateway text are copyrighted, and there is no free API that permits bundling them, so they are not included. Rebuild the bundled files with `npm run build:bibles -- <download-dir>` (see `scripts/build-bibles.mjs`).

### Flashcards tab
Decks: ★ Starred · Needs review · All words · each word list · My added words · each scripture list · decks saved from a sermon scan.
Direction: KO→EN, EN→KO, or mixed. Spaced repetition uses Leitner boxes: **Space** flips the card, and **1 / 2 / 3** grade it Again / Good / Easy. Missed cards come back within the same round. Scripture cards show the full passage on the back. Progress is saved in your browser.

### Glossary tab
Search Korean, English, notes, or 초성. Filter by list or ★. Add your own words here. You can also **Download CSV** (it imports into Anki) or **Print cheat sheet**, which prints a two-column layout.

## Adding words

- **From the app:** use *Save as my word*, Glossary → *Add a word*, or confirm AI words. Everything is saved locally in `data/custom-words.json` (`"status": "ai"` means not reviewed yet). There are no accounts and nothing goes to the cloud. Commit that file to back it up.
- **A whole new list:** copy a block in [`data/word-lists.js`](data/word-lists.js):
  ```js
  { id: "wl14", title: "Word List #14", entries: [
    ["희년", "Year of Jubilee"],
    ["맹세", "oath", { alt: ["맹새"], note: "…", star: true }],
  ]},
  ```
  `alt` holds other spellings to accept, `note` holds nuance shown in yellow, and `star` adds the word to the Starred deck.

## Machine translation (fallback only)

Machine translation is used only for words that aren't in your lists. It runs locally through **Ollama**: it's free and private, uses temperature 0, and is given your glossary terms so it keeps your wording.
- Install the Ollama app, then run `ollama pull exaone3.5:7.8b`. This is LG's Korean-specialised model, and the app picks it automatically. If it isn't installed, the app falls back to `qwen2.5:7b`, then `gemma2:9b`, then `llama3`. To force a specific model, set `OLLAMA_MODEL`.
- If Ollama isn't running, you'll just see *Not in your word lists* with suggestions and **Save as my word**.
- `LIBRETRANSLATE_URL` with `MT_PROVIDERS=ollama,libretranslate` is optional, if you run your own LibreTranslate instance.

## Project layout

```
server.js                  Express: serves public/, /lib, word lists; /api/scripture, /api/translate, /api/custom-words
lib/glossary.js            deterministic lookup / scan / fuzzy / reverse lookup
lib/korean.js              Hangul helpers (jamo, 초성, particles, conjugation forms)
lib/reference.js           scripture reference parser (EN + KO)
lib/bible-books.js         66 books + aliases
lib/scripture-service.js   passage assembly, versification fallback, ESV text alignment
data/word-lists.js         YOUR word lists + scripture lists
data/custom-words.json     words added from the app
data/bible/*.json          bundled public-domain Bibles
public/                    the web app (index.html, styles.css, js/)
tests/                     vitest
```
