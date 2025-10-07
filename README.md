# Church Interpreter Helper (prototype)

A lightweight prototype for a church interpreter companion. The app ships as a static HTML/JS site so it can be opened locally or from any static host (e.g. GitHub Pages, Netlify, Vercel).

## Current capabilities

- Starry-night themed chat surface that mimics a translator chatbot.
- Session manager to capture service metadata (message title, scripture passage, pastor/speaker). Sessions persist in the browser via `localStorage`.
- Message log per session so previous interpretations stay linked to the relevant gathering.
- Translator that uses a small bilingual dictionary first, then falls back to a local LLM (via Ollama) with automatic fallback to LibreTranslate if the LLM is offline—all behind a single Express server on `http://localhost:5173`.
- Scripture query recogniser that understands a few English/Korean aliases (e.g. `Acts`, `행`, `요한복음`) and fetches verses from [bible-api.com](https://bible-api.com/) (World English Bible), falling back to bundled samples when offline.
- Similar-term suggestions (up to 10) when a word is unknown.

## Quick start

1. Install dependencies: `npm install`.
2. (Optional but recommended) Install Ollama and pull a bilingual-capable model, e.g.:  
   ```bash
   ollama pull llama3
   ```
3. Start the all-in-one server:  
   ```bash
   npm start
   ```  
   This serves the frontend at [http://localhost:5173](http://localhost:5173) and exposes `POST /api/translate`.
4. Visit the site, click **Manage Sessions** to create/select a session.
5. Type Korean or English phrases in the chat box (press **Enter** to send, **Shift+Enter** for a new line). Unknown phrases first try your local Ollama model; if that fails, the server automatically falls back to LibreTranslate.
6. Ask for passages by typing references such as `Acts 1:8` or `요한복음 3:16-17`. English aliases call the free scripture API; Korean aliases fall back to the bundled demo data when a Korean translation is unavailable.

> Tip: Because everything runs in the browser, your data is stored locally. Clearing browser storage will remove saved sessions.

## What still needs to happen

This prototype intentionally avoids external APIs so it can run for free, but that also limits fidelity:

- **Translation quality**: The shared LibreTranslate server is rate-limited. For real-time service translation you should deploy your own LibreTranslate instance (Docker), plug in a Marian/NLLB model, or connect to a local LLM with bilingual support via a small proxy.
- **Scripture coverage**: bible-api.com currently returns the World English Bible. A licensed ESV dataset or an open translation (WEB/KRV, etc.) should replace or augment it, especially for Korean passages.
- **Contextual awareness**: The glossary grows from previous translations, but there is no deep contextual reasoning. You can connect to a local inference server (Ollama, LM Studio) and proxy prompts through a custom backend to stay free of usage-based billing.
- **Searchable archive**: Right now data lives in `localStorage`. To collaborate across devices you will need a backend (Firebase, Supabase, simple REST API) or file export/import.
- **UI polish**: Add typing indicators, message timestamps, accessibility improvements, and responsive tweaks for tablets.

## LLM-backed translation workflow (Ollama example)

This project includes `server.js`, an Express server that serves the frontend *and* proxies translation requests. The flow looks like this:

1. The browser sends `{ text, sourceLang }` to `POST /api/translate` on the same origin (e.g., `http://localhost:5173/api/translate`).
2. The server tries to translate via Ollama (`OLLAMA_HOST` / `OLLAMA_MODEL`). If it succeeds, the response is returned immediately.
3. If the Ollama call fails or times out, the server automatically falls back to LibreTranslate (or a custom URL via `FALLBACK_TRANSLATE_URL`).
4. The browser displays the translated text and stores it in the session glossary for future reuse.

### Customising the pipeline

1. **Ollama options**  
   - `OLLAMA_MODEL=solar npm start` to switch models.  
   - `OLLAMA_HOST=http://localhost:11435 npm start` if you run Ollama on a different port.

2. **Disable Ollama / force fallback**  
   Start the server with `OLLAMA_HOST=disabled npm start`. The server will skip the local call and use the fallback translator immediately.

3. **Use your own fallback API**  
   Point `FALLBACK_TRANSLATE_URL` to any LibreTranslate-compatible endpoint:  
   ```bash
   FALLBACK_TRANSLATE_URL=https://your-instance.example.com/translate npm start
   ```

4. **Adjust timeouts**  
   Use `OLLAMA_TIMEOUT_MS` (default 15000) to control how long the server waits before falling back.

## Suggested next steps

1. Measure latency and tweak the LLM prompt/temperature or choose a faster model (e.g., `gemma2:2b` via Ollama) for live services.
2. Import a full bilingual scripture dataset. Normalise book aliases (English/Korean abbreviations) and expand the parser to cover verse ranges, multiple passages, and chapter-only queries.
3. Persist sessions in structured folders by exporting JSON or Markdown files. A simple “Download session” button can mirror the folder organisation you described (title/verse/speaker).
4. Add tests (e.g. Vitest) for the parsing utilities so future upgrades are safe.

Feel free to point me to the direction you prefer (pure front-end vs. lightweight backend) and I can keep building from here.
