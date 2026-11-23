/**
 * AI fallback for words/sentences NOT in your lists. Used by the Mac server and the website.
 * Providers are tried in order until one answers:
 *   - Gemini (Google, free tier)          GEMINI_API_KEY   — strong Korean; free-tier input may be used by Google
 *   - Claude (Anthropic, paid, optional)  ANTHROPIC_API_KEY
 *   - Workers AI (Cloudflare, free tier)  website only (binding)
 *   - Ollama (local, Mac only)            defined in server.js
 * "strong" providers are also asked for Korean "did you mean" suggestions.
 */
import { buildTermPrompt, buildTranslatePrompt, cleanModelOutput, isShortTerm, parseTermResponse } from "../../lib/mt-prompt.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";
export const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("timed out");
    throw error;
  } finally {
    clearTimeout(t);
  }
}

/** Google Gemini via the REST generateContent endpoint. */
export function geminiProvider({ apiKey, model = DEFAULT_GEMINI_MODEL, fetchImpl = fetch, timeoutMs = 15000 }) {
  const supportsThinkingLevel = /^gemini-(?:[3-9]|\d{2,})/.test(model);
  async function call(prompt, { json, maxTokens }, withThinking) {
    const generationConfig = { maxOutputTokens: maxTokens };
    if (json) generationConfig.responseMimeType = "application/json";
    if (withThinking) generationConfig.thinkingConfig = { thinkingLevel: "MINIMAL" }; // fastest answers
    return fetchWithTimeout(
      fetchImpl,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig }),
      },
      timeoutMs
    );
  }
  return {
    id: "gemini",
    label: `Gemini (${model})`,
    strong: true,
    async complete(prompt, { json = false, maxTokens = 512 } = {}) {
      let r = await call(prompt, { json, maxTokens }, supportsThinkingLevel);
      if (r.status === 400 && supportsThinkingLevel) r = await call(prompt, { json, maxTokens }, false); // model without thinking levels
      if (!r.ok) throw new Error(`Gemini status ${r.status}`);
      const data = await r.json();
      const candidate = data?.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((p) => p?.text ?? "").join("");
      if (!text.trim()) throw new Error(`Gemini returned no text (${candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "unknown"})`);
      return text;
    },
  };
}

/** Anthropic Claude via the official SDK (optional, paid). */
export function claudeProvider({ apiKey, model = DEFAULT_CLAUDE_MODEL, client = null }) {
  let anthropic = client;
  return {
    id: "claude",
    label: `Claude (${model})`,
    strong: true,
    async complete(prompt) {
      if (!anthropic) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        anthropic = new Anthropic({ apiKey, timeout: 20000, maxRetries: 1 });
      }
      const response = await anthropic.beta.messages.create({
        model,
        max_tokens: 4000, // adaptive thinking shares this; answers themselves are short
        output_config: { effort: "low" }, // short lookup — keep it fast and cheap
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // if this model declines, the API retries on a fallback model
        messages: [{ role: "user", content: prompt }],
      });
      if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new Error(`Claude returned no text (${response.stop_reason})`);
      return text;
    },
  };
}

/** Cloudflare Workers AI (website only; `ai` is the env.AI binding). */
export function workersAiProvider({ ai, model = DEFAULT_WORKERS_AI_MODEL }) {
  return {
    id: "workers-ai",
    label: "Cloudflare Workers AI",
    strong: false,
    async complete(prompt, { maxTokens = 512 } = {}) {
      const r = await ai.run(model, { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0 });
      const text = typeof r === "string" ? r : typeof r?.response === "string" ? r.response : JSON.stringify(r?.response ?? "");
      if (!text.trim()) throw new Error("Workers AI returned no text");
      return text;
    },
  };
}

/** Validate a POST /api/translate body. Returns { text, sourceLang, hints } or { error }. */
export function parseTranslateRequest(body) {
  const { text, sourceLang, hints } = body ?? {};
  if (typeof text !== "string" || !text.trim() || !["ko", "en"].includes(sourceLang)) {
    return { error: "`text` and `sourceLang` (ko|en) are required." };
  }
  return {
    text: text.trim().slice(0, 2000),
    sourceLang,
    hints: Array.isArray(hints)
      ? hints
          .filter((h) => h && typeof h.ko === "string" && typeof h.en === "string")
          .slice(0, 40)
          .map((h) => ({ ko: h.ko.slice(0, 80), en: h.en.slice(0, 160) }))
      : [],
  };
}

/**
 * Translate with the first provider that answers.
 * Returns { translatedText, provider, corrected, suggestions, typedIsStandard }.
 */
export async function translateWithProviders(providers, { text, sourceLang, hints = [] }) {
  const short = isShortTerm(text);
  const errors = [];
  for (const p of providers) {
    try {
      // Single terms: ask for JSON so the model can also suggest what was meant (English always;
      // Korean only on strong models — small models guessed Korean spellings wrong too often).
      if (short && (sourceLang === "en" || p.strong)) {
        const parsed = parseTermResponse(await p.complete(buildTermPrompt(text, sourceLang), { json: true, maxTokens: 250 }), text, sourceLang);
        if (parsed) {
          return {
            translatedText: parsed.translation,
            provider: p.label,
            corrected: parsed.corrected,
            suggestions: parsed.suggestions,
            typedIsStandard: parsed.typedIsStandard,
          };
        }
      }
      const out = cleanModelOutput(await p.complete(buildTranslatePrompt(text, sourceLang, hints), { maxTokens: short ? 80 : 800 }));
      if (out) return { translatedText: out, provider: p.label, corrected: null, suggestions: [], typedIsStandard: true };
      errors.push(`${p.id}: empty answer`);
    } catch (error) {
      errors.push(`${p.id}: ${error.message}`);
    }
  }
  const error = new Error(providers.length ? "No AI translation available right now." : "No AI provider is set up.");
  error.detail = errors.join("; ");
  throw error;
}
