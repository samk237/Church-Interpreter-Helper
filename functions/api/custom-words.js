import { removeWord, upsertWord } from "../../server/core/custom-words.js";
import { readWords, writeWords } from "../../server/web/words-store.js";

const noDb = () => Response.json({ error: "Storage isn't set up (D1 binding DB)." }, { status: 500 });

export async function onRequestGet({ env }) {
  if (!env.DB) return noDb();
  return Response.json({ words: await readWords(env.DB) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return noDb();
  const result = upsertWord(await readWords(env.DB), await request.json().catch(() => null));
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  if (result.changed) await writeWords(env.DB, result.words);
  return Response.json({ words: result.words });
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return noDb();
  const words = removeWord(await readWords(env.DB), new URL(request.url).searchParams.get("ko"));
  await writeWords(env.DB, words);
  return Response.json({ words });
}
