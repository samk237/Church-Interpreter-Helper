/**
 * ESV text via the official ESV API. The key stays on the server (Mac or Cloudflare);
 * the browser sends reference labels and aligns the returned text with its verse list.
 */
export const ESV_INFO = {
  id: "esv",
  short: "ESV",
  name: "English Standard Version",
  language: "en",
  credit:
    "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
};

export function esvKeyUsable(key) {
  const k = String(key ?? "").trim();
  return k.length > 0 && !/your_esv/i.test(k);
}

/** Parse the `refs` query param: a JSON array of up to 20 short reference labels like "Romans 8:1-2". */
export function parseEsvRefs(raw) {
  let refs;
  try {
    refs = JSON.parse(String(raw ?? ""));
  } catch {
    return null;
  }
  if (!Array.isArray(refs) || refs.length === 0 || refs.length > 20) return null;
  const ok = refs.every((r) => typeof r === "string" && r.length <= 80 && /^[1-3]?\s?[A-Za-z][A-Za-z ]*\s[\d:,\- ]+$/.test(r));
  return ok ? refs : null;
}

/** Fetch ESV text for each label (in order). Throws if any fails. */
export async function fetchEsvTexts(labels, { apiKey, cache = new Map(), fetchImpl = fetch, timeoutMs = 8000 }) {
  const out = [];
  for (const label of labels) {
    if (cache.has(label)) {
      out.push(cache.get(label));
      continue;
    }
    const params = new URLSearchParams({
      q: label,
      "include-passage-references": "false",
      "include-verse-numbers": "true",
      "include-first-verse-numbers": "true",
      "include-footnotes": "false",
      "include-footnote-body": "false",
      "include-headings": "false",
      "include-short-copyright": "false",
      "include-copyright": "false",
      "include-selahs": "true",
      "indent-paragraphs": "0",
      "indent-poetry": "false",
      "line-length": "0",
    });
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`https://api.esv.org/v3/passage/text/?${params}`, {
        headers: { Authorization: `Token ${apiKey}` },
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(error.name === "AbortError" ? "ESV API timed out" : `ESV API unreachable (${error.message})`);
    } finally {
      clearTimeout(t);
    }
    if (!response.ok) throw new Error(`ESV API status ${response.status}`);
    const payload = await response.json();
    const text = (payload.passages ?? []).join(" ");
    if (!text.trim()) throw new Error("ESV returned no text");
    cache.set(label, text);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    out.push(text);
  }
  return out;
}
