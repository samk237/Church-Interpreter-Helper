import { ESV_INFO, esvKeyUsable, fetchEsvTexts, parseEsvRefs } from "../../server/core/esv.js";

const cache = new Map(); // per worker instance

export async function onRequestGet({ request, env }) {
  if (!esvKeyUsable(env.ESV_API_KEY)) return Response.json({ error: "ESV is not set up (ESV_API_KEY secret)." }, { status: 501 });
  const refs = parseEsvRefs(new URL(request.url).searchParams.get("refs"));
  if (!refs) return Response.json({ error: "Bad reference list." }, { status: 400 });
  try {
    return Response.json({ texts: await fetchEsvTexts(refs, { apiKey: env.ESV_API_KEY, cache }), info: ESV_INFO });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }
}
