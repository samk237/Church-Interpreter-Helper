# Costs, free limits, and how the AIs compare

*Checked on November 23, 2026. Free plans change. The "Where to check" column shows where to see the current numbers.*

## The short version

- **It costs $0.** None of these services has a card on file, and a free plan can't bill you. Going over a limit just stops that one feature until its daily reset.
- **Your word lists, flashcards, glossary, and Korean Bible have no limits.** They run on your phone or computer, not on a service.
- **To keep it free:**
  - Don't turn on billing or add a card in Google AI Studio or Google Cloud.
  - Don't upgrade Cloudflare to "Workers Paid".
  - Don't add a Claude (`ANTHROPIC_API_KEY`) key, which is paid.

## Free limits

| Service | What the app uses it for | Free limit | Resets | If you go over | Where to check |
|---|---|---|---|---|---|
| **Gemini** (Google) | AI for words and sentences not in your lists, and Korean "did you mean" | About **500 lookups a day** and **15 a minute**. Google doesn't publish these numbers, so they come from other users' reports. Your actual limit is shown in AI Studio. | Midnight Pacific | That lookup goes to the backup AI | [aistudio.google.com](https://aistudio.google.com) → usage / rate limits |
| **ESV** (Crossway) | ESV text | **5,000 lookups a day**, 1,000 an hour, 60 a minute, and up to 500 verses per lookup | Daily | Crossway slows you down, and the app shows the WEB with a warning | [api.esv.org](https://api.esv.org) → your account |
| **Cloudflare website** | Every page open and every lookup that reaches the server, on the website | **100,000 requests a day** | Midnight UTC (late afternoon or evening in the US) | The site shows a Cloudflare error (1027) until the reset | [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → interpreter-helper |
| **Cloudflare database** (D1) | Your words, flashcard progress, decks, sessions and settings, plus sign-in lockouts | 5 million reads and 100,000 writes a day, 5 GB storage | Midnight UTC | Saving to the website pauses until the reset. Each device keeps your changes and saves them afterwards. | Dashboard → Storage & Databases → D1 |
| **Cloudflare AI** (Gemma 4) | The website's backup AI | 10,000 "neurons" a day, which is about **4,500 lookups** (about 2 neurons each when tested) | Midnight UTC | The backup AI is unavailable until the reset | Dashboard → AI → Workers AI |
| **Cloudflare publishing** | `npm run web:deploy` / `web:setup` | 500 publishes a month | Monthly | Publishing waits | — |

**A typical Sunday:** opening the app takes about 25 requests. Looking a word up in your own lists takes none, because it runs on the phone. An AI lookup or a scripture passage takes 1–3. Even a heavy service with 50 AI lookups and 20 passages stays under **300 of the 100,000** daily website requests, and uses about **50 of Gemini's ~500**. Saving data is tiny too:
- Each flashcard answer or lookup is one database write, so 200 flashcards is 200 of 100,000.
- Opening the app reads your saved items once, which is a few hundred to a few thousand of the 5 million daily reads.

**The Mac and the website share one Gemini allowance and one ESV allowance**, because they use the same keys. The Cloudflare limits apply to the website only.

**ESV terms** (free for non-commercial and church use): every ESV passage must show the ESV copyright line and a link to esv.org. The app adds both automatically.

## Mac mode vs. website

| | **Website** (works with the Mac off) | **Mac mode** (`npm start` / `npm run phone`) |
|---|---|---|
| What has to be running | Nothing. It runs on Cloudflare's computers, so you can close the laptop or turn it off. | The Mac must be open and awake, with `npm start` running. Ctrl+C stops it, and it also stops when the Mac sleeps. |
| Where it works | Anywhere with internet, including cellular | On the Mac. With `npm run phone`, it also works on a phone on the same Wi-Fi. Some church Wi-Fi blocks this; the phone's Personal Hotspot fixes it. |
| Without internet | Once the page is open, your word lists keep working. Scripture and AI need signal. | Word lists, the Korean Bible, and the local AI all work offline. ESV needs internet. |
| AI order | Gemini → Gemma 4 (Cloudflare) | Gemini → EXAONE (on the Mac). Add `AI_PROVIDERS=ollama` to `.env.local` to keep the Mac fully private. |
| Your words, AI words to review, flashcards, decks, sessions, settings | Saved on Cloudflare and shared by every device you sign in on | Saved on the Mac (`data/my-data.json`). `npm run sync` merges it with the website both ways. |
| Getting updates | Run `npm run web:deploy` from the Mac | Restart `npm start` |
| Sign-in | Website password, once per device | `npm run phone` uses an access code, once per device |

**Forgot the website password?** Run `npm run web:setup` again:
1. Type a new password.
2. Press Enter to reuse your saved keys.
3. Press Enter (No) when it offers to copy the Mac's words, so the website's own words are kept.

It republishes the site, and every device signs out.

## How the AIs compare

**Tested on November 23, 2026.** Every model got the same 15 inputs, sent through the app's own prompts:
- 8 Korean words, 2 of them misspelled by ear
- 3 English terms
- 4 sentences

**Ranking:** Gemini > Gemma 4 > EXAONE > Llama 3.3.

| | **Gemini 3.5 Flash-Lite** (first choice) | **Gemma 4** (website backup) | **EXAONE 3.5** (Mac backup) | Llama 3.3 70B (old website backup, replaced) |
|---|---|---|---|---|
| Korean church words | Best | Very good | Fair: missed some | Fair: missed some |
| Did you mean: 구재 → 구제, 궁휼 → 긍휼 | ✓ both | ✓ both | Not used; it guessed wrong too often | Not used |
| English → Korean | ✓ | ✓ | ✓ | ✗ sometimes garbled |
| Sentences | ✓ | ✓ | ✓ | ✓ |
| Typical speed | 0.6–1 s, up to 10 s when Google is busy | About 1 s for sentences and English terms. For Korean words it also checks the spelling, which takes 1–10 s (usually about 3 s). | 1.5–4 s | 0.5–1 s |
| Reliability | Google said "busy" on about **1 in 8** lookups (sometimes more). The app then moves straight on to the backup. | No errors | Always available while the Mac is on | — |
| Privacy | Google may use free-tier lookups to improve its products | Sent to Cloudflare | Never leaves your Mac | — |

Sample answers:

| Typed | Gemini | Gemma 4 | EXAONE | Llama 3.3 |
|---|---|---|---|---|
| 구재 (meant 구제) | almsgiving / charity, *did you mean 구제?* | relief / almsgiving, *did you mean 구제?* | Redemption / Salvation ✗ | Original Sin ✗ |
| 궁휼 (meant 긍휼) | mercy / compassion, *did you mean 긍휼?* | mercy / compassion, *did you mean 긍휼?* | Mercy / Compassion | Compassion / Mercy |
| 견인 | perseverance / upholding | Perseverance of the saints; "towing" when asked in did-you-mean mode | Encouragement / Guidance ✗ | Leading / Guidance ✗ |
| 성령충만 | filling of the Holy Spirit / filled with the Holy Spirit | Fullness of the Holy Spirit / Filled with the Holy Spirit | Spirit-filled / Baptism in the Holy Spirit (half right) | Fullness of the Spirit / Spirit Filling |
| intercession | (busy) | 중보 기도 / 중보 | 중보 / 중재 | `} /` ✗ |
| 하나님께서 우리를 먼저 사랑하셨기 때문에 우리도 서로 사랑해야 합니다. | Because God loved us first, we must also love one another. | Because God loved us first, we must also love one another. | Because God first loved us, we must love one another. | Because God loved us first, we also must love one another. |

Also tested and dropped: **Qwen 3.8** (Cloudflare) took 5–70 s per answer in its default "thinking" mode, which is too slow for live use.

**Bottom line:** Gemini is the strongest, and Gemma 4 is a close second that covers you when Google is busy. EXAONE is the weakest of the three, but it is the only one that works offline and keeps everything private. Whichever AI answers, the app labels it "🤖 AI suggestion — verify", and your own lists always take priority.

## Sources

- Gemini rate limits: [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) (the exact free-tier numbers are shown in AI Studio)
- ESV API terms and limits: [api.esv.org](https://api.esv.org/)
- Cloudflare Pages limits: [developers.cloudflare.com/pages/platform/limits](https://developers.cloudflare.com/pages/platform/limits/)
- Cloudflare Workers and D1 free plan: [developers.cloudflare.com/workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- D1 daily limits: [D1 free-tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- Workers AI free allowance and per-model costs: [developers.cloudflare.com/workers-ai/platform/pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
