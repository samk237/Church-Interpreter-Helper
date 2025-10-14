import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? "5173", 10);
const STATIC_ROOT = process.env.STATIC_ROOT ?? __dirname;

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3";
const OLLAMA_TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_TIMEOUT_MS ?? "15000", 10);
const FALLBACK_TRANSLATE_URL =
  process.env.FALLBACK_TRANSLATE_URL ?? "https://libretranslate.de/translate";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(STATIC_ROOT, { extensions: ["html"] }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    ollamaHost: OLLAMA_HOST,
    ollamaModel: OLLAMA_MODEL,
    fallback: FALLBACK_TRANSLATE_URL,
  });
});

app.post("/api/translate", async (req, res) => {
  const { text, sourceLang } = req.body ?? {};
  if (!text || !sourceLang) {
    return res.status(400).json({ error: "`text` and `sourceLang` are required." });
  }

  const targetLang = sourceLang === "ko" ? "en" : "ko";

  try {
    const llmResult = await translateWithOllama(text, sourceLang, targetLang);
    if (llmResult) {
      console.log(`[translator] Ollama ${sourceLang}->${targetLang} success.`);
      return res.json({ translatedText: llmResult, provider: "ollama" });
    }
  } catch (error) {
    console.warn("[translator] Ollama translation failed:", error.message);
  }

  try {
    const fallbackResult = await translateWithFallback(text, sourceLang, targetLang);
    console.log(`[translator] Fallback ${sourceLang}->${targetLang} used.`);
    return res.json({ translatedText: fallbackResult, provider: "fallback" });
  } catch (error) {
    console.error("[translator] Fallback translation failed:", error);
    return res.status(502).json({
      error: "All translation providers failed.",
      detail: error.message ?? "Unknown error",
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(STATIC_ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Church Interpreter Helper running at http://localhost:${PORT}`);
  console.log("Translation endpoint: POST /api/translate");
});

async function translateWithOllama(text, sourceLang, targetLang) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildPrompt(text, sourceLang, targetLang),
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with status ${response.status}`);
    }

    const payload = await response.json();
    const output = payload?.response;
    if (typeof output !== "string" || output.trim().length === 0) {
      throw new Error("Ollama returned an empty response.");
    }

    return output.trim();
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("[translator] Ollama request timed out");
      throw new Error("Ollama request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateWithFallback(text, sourceLang, targetLang) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(FALLBACK_TRANSLATE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
      }),
    });

    if (!response.ok) {
      throw new Error(`Fallback responded with status ${response.status}`);
    }

    const payload = await response.json();
    const candidate =
      payload?.translatedText ??
      payload?.translated_text ??
      payload?.translation ??
      payload?.result ??
      "";
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      throw new Error("Fallback returned an empty response.");
    }

    return candidate.trim();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Fallback request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(text, sourceLang, targetLang) {
  const sourceLabel = sourceLang === "ko" ? "Korean" : "English";
  const targetLabel = targetLang === "ko" ? "Korean" : "English";

  return [
    "You are an expert bilingual church interpreter with deep knowledge of Christian theological terminology.",
    "Translate the following text accurately, paying special attention to theological and biblical terms.",
    "",
    "IMPORTANT THEOLOGICAL TERMS (use these as reference):",
    "- 번영신학/귀복주의 = prosperity gospel",
    "- 성령 = Holy Spirit",
    "- 성령내주 = indwelling of the Holy Spirit",
    "- 은혜 = grace",
    "- 구원 = salvation",
    "- 속죄 = atonement/redemption",
    "- 성화 = sanctification",
    "- 칭의 = justification",
    "- 회개 = repentance",
    "- 복음 = gospel",
    "- 십일조 = tithe/tithing",
    "- 장로 = elder",
    "- 집사 = deacon",
    "- 선교 = mission/missions",
    "- 부활 = resurrection",
    "- 강림 = advent/coming",
    "- 삼위일체 = Trinity",
    "- 성찬식 = communion/Lord's Supper",
    "- 세례 = baptism",
    "- 환란 = tribulation",
    "- 교리 = doctrine",
    "- 소요리 문답 = Shorter Catechism",
    "- 서신서 = epistles",
    "- 본질상 진노의 자녀 = by nature, children of wrath",
    "- 성육하고 번성 = be fruitful and multiply",
    "- 견고한 진 = stronghold",
    "- 징계 = discipline",
    "- 다스리고 정복 = rule over and subdue",
    "- 마음을 주장하다 = guard our hearts",
    "- 철야 예배 = all-night vigil",
    "",
    "Guidelines:",
    "1. For theological terms, use the standard English theological equivalent",
    "2. Preserve scripture references and names accurately",
    "3. Maintain the tone appropriate for church context",
    "4. Return ONLY the translation, no explanations or commentary",
    "5. If given a scripture reference with multiple verses, translate the reference with verses labeled in between verses",
    "",
    `Source language: ${sourceLabel}`,
    `Target language: ${targetLabel}`,
    `Text to translate: ${text}`,
    "",
    "Translation:",
  ].join("\n");
}
