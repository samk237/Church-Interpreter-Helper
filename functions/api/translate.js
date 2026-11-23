import { parseTranslateRequest, translateWithProviders } from "../../server/core/ai.js";
import { buildProviders } from "../../server/web/providers.js";

export async function onRequestPost({ request, env }) {
  if (Number(request.headers.get("Content-Length") ?? 0) > 65536) return Response.json({ error: "Too long." }, { status: 413 });
  const req = parseTranslateRequest(await request.json().catch(() => null));
  if (req.error) return Response.json({ error: req.error }, { status: 400 });
  try {
    return Response.json(await translateWithProviders(buildProviders(env), req));
  } catch (error) {
    return Response.json({ error: error.message, detail: error.detail }, { status: 502 });
  }
}
