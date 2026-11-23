// Flashcard progress, saved decks, sessions and settings, shared by every device that opens the website.
import * as dataApi from "../../server/core/user-data-api.js";
import { createD1Store } from "../../server/web/d1-store.js";

const respond = async (env, run) => {
  if (!env.DB) return Response.json({ error: "Storage isn't set up (D1 binding DB)." }, { status: 500 });
  const { status, body } = await run(createD1Store(env.DB));
  return Response.json(body, { status });
};

export const onRequestGet = ({ env }) => respond(env, (store) => dataApi.getSync(store));

export const onRequestPost = async ({ request, env }) => {
  const body = await request.json().catch(() => null);
  return respond(env, (store) => dataApi.postSync(store, body));
};
