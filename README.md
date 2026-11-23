# Church Interpreter Helper

A Korean ↔ English companion for live church interpreting. It is **deterministic first**: your own word lists decide the answer, the same input always gives the same output, and anything that comes from machine translation is clearly labelled.

> [!IMPORTANT]
> ## 🔄 To update the website, run:
> ```bash
> npm run web:deploy
> ```
> Run it in this project folder after **any change to the code or the word lists**. It takes about 30 seconds, and phones get the update the next time the app is opened (close and reopen the home-screen app). Your saved words, flashcards and sessions are never touched by an update.
>
> **Other commands you'll use:**
> - `npm run sync` merges this Mac's data with the website's.
> - `npm start` runs Mac mode.
> - `npm run web:setup` changes the website password.

## Two ways to run it

You can use either, or both. They share the same app and your same word lists.

| | **Mac mode** (`npm start` / `npm run phone`) | **Website** (Cloudflare, free) |
|---|---|---|
| Needs the Mac on | Yes | No — works anywhere on your phone |
| Your word lists, flashcards, Korean Bible | ✓ | ✓ |
| ESV | ✓ (your key in `.env.local`) | ✓ (your key stored on Cloudflare) |
| AI for new words | Local EXAONE on the Mac (private); Gemini first if you add a key | Gemini (free) → Cloudflare's free Gemma 4 as backup |
| Korean "did you mean (AI guess)" | Only with a Gemini key | ✓ (Gemini, or Gemma 4 when Gemini is busy) |
| Your words, AI words to review, flashcard progress, decks, sessions, settings | Saved on the Mac (`data/my-data.json`) | Saved on Cloudflare, shared by every device you sign in on |
| Privacy | Everything stays on the Mac, unless you add a Gemini key | Password-protected; Gemini's free tier may use lookups to improve Google's products |

Run **`npm run sync`** any time to merge the Mac and the website in both directions. See [Your data](#your-data).

**Costs, free limits, and how the AIs compare:** see [LIMITS.md](LIMITS.md). It costs $0 as long as you never add a card or turn on billing.

## Mac mode

```bash
npm install
npm start            # this Mac only → http://localhost:5173
npm run phone        # also open it on your phone (same Wi-Fi), protected by an access code
npm test
```

Optional: copy `.env.local.example` to `.env.local` to add your ESV key and/or a Gemini key.

### Using it on your phone during a service

1. On the Mac, run `npm run phone`. The terminal shows a QR code and an 8-character access code. The same QR code is in the app's ⚙ settings on the Mac.
2. Make sure the phone is on the **same Wi-Fi** as the Mac, then scan the QR code with the phone's camera. The phone stays unlocked after that.
3. Optional: use Share → **Add to Home Screen** so it opens full-screen like an app.

Things to know:
- Everything still runs on the Mac (your lists, ESV, the AI), so keep the Mac awake with the helper and Ollama running.
- Other people on the Wi-Fi can't open the app without your access code. Wrong guesses are rate-limited. To change the code, delete the `.phone-code` file.
- Some church Wi-Fi networks block devices from reaching each other. If the phone can't connect, turn on the phone's **Personal Hotspot** and join it from the Mac. ESV still works through the phone's data.
- `npm start` (the default) can only be opened on the Mac itself.

## Website (Mac off)

One-time setup:
1. Optional: get a free Gemini key at **https://aistudio.google.com/apikey** → **Create API key**. You can also add it to `.env.local` as `GEMINI_API_KEY=…`, and setup will offer to reuse it.
2. Run `npm run web:setup`. It will:
   - open a browser so you can sign in to Cloudflare (or create a free account)
   - create the database and the website
   - ask for a **website password**, plus your ESV and Gemini keys
   - publish the site and print its address (`https://interpreter-helper….pages.dev`)
   - offer to merge this Mac's saved data with the website (`npm run sync`)
3. On your phone, open that address, sign in once, then Share → **Add to Home Screen**.

After you change word lists or code, publish again with **`npm run web:deploy`**. To test the website locally: `npm run web:dev` (needs a `.dev.vars` file with `APP_PASSWORD=…`).

Everything sits behind your password, including the page, your lists, and the APIs. Wrong passwords are rate-limited.

**Forgot the password, or want a new one?** Run `npm run web:setup` again, type the new password, and press Enter at each of the other questions. It reuses your saved keys, republishes the site, and merges data without deleting anything. Every device is signed out and signs in again with the new password.

### Light / dark mode
The app follows your device's theme by default. Use the ◐ button (or ⚙ → Theme) to pick System, Light, or Dark.

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
| 개역한글 (Korean, 1961) | bundled `public/bible/krv/` (one file per book) | public domain |
| World English Bible (Updated) | bundled `public/bible/webu/` — **emergency fallback only** (no key / no internet), labelled when used | public domain |
| **ESV** — the English shown | real ESV text fetched live from Crossway's official API (set `ESV_API_KEY`) | free for non-commercial use, with the required copyright notice (shown automatically) |

NIV, 개역개정, and BibleGateway text are copyrighted, and there is no free API that permits bundling them, so they are not included. Rebuild the bundled files with `npm run build:bibles -- <download-dir>` (see `scripts/build-bibles.mjs`).

### Flashcards tab
Decks: ★ Starred · Needs review · All words · each word list · My added words · each scripture list · decks saved from a sermon scan.
Direction: KO→EN, EN→KO, or mixed. Spaced repetition uses Leitner boxes: **Space** flips the card, and **1 / 2 / 3** grade it Again / Good / Easy. Missed cards come back within the same round. Scripture cards show the full passage on the back. Progress is saved with your data, so it carries over between your phone and PC.

### Glossary tab
Search Korean, English, notes, or 초성. Filter by list or ★. Add your own words here. You can also **Download CSV** (it imports into Anki) or **Print cheat sheet**, which prints a two-column layout.

## Adding words

- **From the app:** use *Save as my word*, Glossary → *Add a word*, or confirm AI words. They're saved with the rest of [your data](#your-data); `"status": "ai"` means not reviewed yet.
- **A whole new list:** copy a block in [`data/word-lists.js`](data/word-lists.js):
  ```js
  { id: "wl14", title: "Word List #14", entries: [
    ["희년", "Year of Jubilee"],
    ["맹세", "oath", { alt: ["맹새"], note: "…", star: true }],
  ]},
  ```
  `alt` holds other spellings to accept, `note` holds nuance shown in yellow, and `star` adds the word to the Starred deck.

## AI for words not in your lists (fallback only)

The AI is used only when your lists don't answer, and its answers are always labelled **🤖 AI suggestion — verify**. Single words are saved to the Glossary as *AI · unreviewed* for you to confirm later.

The app tries these in order, skipping any that aren't set up (change the order with `AI_PROVIDERS`):
1. **Gemini** (`GEMINI_API_KEY`, free): the best Korean. It also gives the Korean **"Did you mean (AI guess)"** chips when you type a word by ear and misspell it. If one of its guesses is already in your lists, your entry is shown instead. On the free tier, Google sometimes answers "busy" (about 1 lookup in 8 when tested). The app then moves straight on to the next AI.
2. **Claude** (`ANTHROPIC_API_KEY`, optional and paid): the highest quality.
3. **On the Mac:** the local model through Ollama (free, private). Run `ollama pull exaone3.5:7.8b` and the app picks it automatically. It doesn't make Korean spelling guesses; it got them wrong too often in testing.
4. **On the website:** Cloudflare's **Gemma 4** (free daily allowance), with "thinking" turned off for speed. It also makes Korean spelling guesses. It replaced Llama 3.3 after a side-by-side test (see [LIMITS.md](LIMITS.md#how-the-ais-compare)). Choose another model with `WORKERS_AI_MODEL`.

If no AI is available, you still get *Not in your word lists*, the glossary's own "Did you mean" suggestions, and **Save as my word**.

## Your data

Your **words, AI words waiting for review, flashcard progress, saved decks, sessions (transcripts), and settings** are all saved on the server. On the website that's Cloudflare, so **every phone, tablet and PC you sign in on shares the same data.** The theme, the open tab, and which session is open stay per device.

- **Changes save instantly.** They go to Cloudflare right away. Another device shows them when you switch back to the app or refresh it.
- **It works offline too.** Each device keeps a copy, so a dropped signal mid-service doesn't stop you. Changes made offline are saved as soon as the connection is back. ⚙ settings shows the status.
- **Changes don't overwrite each other.** Each item remembers when it last changed, and the newest change wins. A phone that's been asleep can't wipe out newer progress from the PC, and deleted items stay deleted.
- **Mac mode keeps its own copy** in `data/my-data.json`, so it works without internet. Run **`npm run sync`** to merge it with the website in both directions. Nothing is deleted. It's safe to run any time. `npm run sync -- --dry-run` shows what would change without changing anything.
- An AI word you reject (✗) isn't auto-saved again the next time the AI suggests it. You can still add it yourself.

Your data is never committed to git. This repository is public; only the built-in word lists in `data/word-lists.js` are in it.

## Project layout

```
server.js                  Mac server (Express): static app, /api/esv, /api/translate, /api/custom-words, /api/sync, phone mode
functions/                 the same APIs for the website (Cloudflare Pages Functions) + password gate (_middleware.js)
server/core/               shared by both: ai.js (Gemini/Claude/Workers AI), esv.js, auth.js,
                           user-data.js + user-data-api.js (your data: items, newest change wins), custom-words.js (word rules)
server/web/                website-only: d1-store.js (Cloudflare database), providers.js; server/schema.sql
server/file-store.js       Mac storage (data/my-data.json)
server/phone-access.js     Mac phone mode: access code, unlock page, rate limiting
lib/glossary.js            deterministic lookup / scan / fuzzy / reverse lookup (runs in the browser)
lib/korean.js              Hangul helpers (jamo, 초성, particles, conjugation forms)
lib/reference.js           scripture reference parser (EN + KO)
lib/scripture-service.js   passage assembly + ESV alignment (browser); lib/verse-counts.js
lib/mt-prompt.js           AI prompts
data/word-lists.js         YOUR word lists (incl. Darakbang terms) + scripture lists
data/my-data.json          your data on the Mac (not committed — the repo is public)
public/                    the app (index.html, styles.css, js/ — js/sync.js keeps devices in step, icons/, bible/…)
scripts/                   build-bibles, build-web, web-setup, sync (npm run sync)
tests/                     vitest
```
