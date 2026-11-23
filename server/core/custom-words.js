/**
 * Rules for words added from the app (shared by the Mac file store and the website's D1 store).
 * Each word: { ko, en, note, alt?, status: "confirmed" | "ai", addedAt, updatedAt?, reviewedAt? }
 */
const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * Add or update a word. Returns { words, changed } or { error }.
 * - An AI suggestion (status "ai") never overwrites a word that already exists.
 * - `replaces` renames a word (when you fix its Korean spelling during review).
 */
export function upsertWord(words, body, now = new Date().toISOString()) {
  const ko = clip(body?.ko, 80);
  const en = clip(body?.en, 200);
  const note = clip(body?.note, 300);
  const status = body?.status === "ai" ? "ai" : "confirmed";
  const alt = Array.isArray(body?.alt) ? body.alt.map((a) => clip(a, 80)).filter(Boolean).slice(0, 5) : undefined;
  const replaces = clip(body?.replaces, 80);
  if (!ko || !en) return { error: "Both Korean and English are required." };

  let next = [...words];
  const existing = next.find((w) => w.ko === ko);
  if (status === "ai" && existing) return { words, changed: false };
  if (replaces && replaces !== ko) next = next.filter((w) => w.ko !== replaces);

  const current = next.find((w) => w.ko === ko);
  if (current) {
    Object.assign(current, { en, note, status, updatedAt: now });
    if (alt) current.alt = alt;
    if (status === "confirmed") current.reviewedAt = now;
  } else {
    next.push({ ko, en, note, ...(alt?.length ? { alt } : {}), status, addedAt: now, ...(status === "confirmed" ? { reviewedAt: now } : {}) });
  }
  return { words: next, changed: true };
}

export function removeWord(words, ko) {
  const key = clip(ko, 80);
  return words.filter((w) => w.ko !== key);
}
