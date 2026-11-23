import { esvKeyUsable } from "../../server/core/esv.js";
import { buildProviders } from "../../server/web/providers.js";

export async function onRequestGet({ env }) {
  const providers = buildProviders(env);
  return Response.json({
    status: "ok",
    mode: "web",
    esv: esvKeyUsable(env.ESV_API_KEY),
    storage: Boolean(env.DB),
    ai: { available: providers.length > 0, label: providers.map((p) => p.label).join(" → ") || null },
  });
}
