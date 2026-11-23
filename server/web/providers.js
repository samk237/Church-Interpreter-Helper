/**
 * AI providers for the website (Cloudflare). Order: AI_PROVIDERS env (default gemini,claude,workers-ai),
 * skipping any that aren't configured.
 */
import { claudeProvider, DEFAULT_CLAUDE_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_WORKERS_AI_MODEL, geminiProvider, workersAiProvider } from "../core/ai.js";

export function buildProviders(env) {
  const order = String(env.AI_PROVIDERS || "gemini,claude,workers-ai")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const list = [];
  for (const id of order) {
    if (id === "gemini" && env.GEMINI_API_KEY) list.push(geminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL }));
    if (id === "claude" && env.ANTHROPIC_API_KEY) list.push(claudeProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL }));
    if (id === "workers-ai" && env.AI) list.push(workersAiProvider({ ai: env.AI, model: env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL }));
  }
  return list;
}
