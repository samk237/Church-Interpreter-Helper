/**
 * Website gate: everything (pages, word lists, APIs) requires signing in with APP_PASSWORD.
 * Sessions last a year per device; changing APP_PASSWORD signs every device out.
 */
import { loginPage, makeSessionToken, passwordMatches, readCookie, verifySessionToken } from "../server/core/auth.js";

const COOKIE = "cih_session";
const PUBLIC = [/^\/icons\//, /^\/manifest\.webmanifest$/, /^\/favicon\.ico$/];
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;

const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers } });

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  // Every publish also gets its own frozen address (e.g. 1a2b3c4d.interpreter-helper.pages.dev). A phone saved
  // there would be stuck on that version forever, so always send people to the main address.
  const frozen = url.hostname.match(/^[0-9a-f]{8}\.([a-z0-9-]+\.pages\.dev)$/);
  if (frozen) return Response.redirect(`https://${frozen[1]}${url.pathname}${url.search}`, 302);
  if (!env.APP_PASSWORD) return html("<p>Set the APP_PASSWORD secret first (npm run web:setup).</p>", 500);
  const secret = env.SESSION_SECRET || env.APP_PASSWORD;

  if (url.pathname === "/login" && request.method === "POST") return login(request, env, secret);
  if (await verifySessionToken(readCookie(request.headers.get("Cookie"), COOKIE), secret)) {
    if (url.pathname === "/login") return Response.redirect(new URL("/", url), 303);
    return next();
  }
  if (PUBLIC.some((re) => re.test(url.pathname))) return next();
  if (url.pathname.startsWith("/api/")) return Response.json({ error: "Signed out — reload the page and sign in." }, { status: 401 });
  return html(loginPage(), 401);
}

async function login(request, env, secret) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const db = env.DB;
  const now = Date.now();
  const row = db ? await db.prepare("SELECT fails, locked_until FROM login_attempts WHERE ip = ?").bind(ip).first() : null;
  if (row && row.locked_until > now) return html(loginPage({ error: "Too many wrong passwords. Try again in 15 minutes." }), 429);

  const form = await request.formData().catch(() => null);
  if (await passwordMatches(form?.get("password") ?? "", env.APP_PASSWORD)) {
    if (db) await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
    const token = await makeSessionToken(secret);
    return new Response(null, {
      status: 303,
      headers: { Location: "/", "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax` },
    });
  }
  const fails = (row?.fails ?? 0) + 1;
  const lockedUntil = fails >= MAX_FAILS ? now + LOCK_MS : 0;
  if (db) {
    await db
      .prepare("INSERT INTO login_attempts (ip, fails, locked_until) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until")
      .bind(ip, lockedUntil ? 0 : fails, lockedUntil)
      .run();
  }
  return html(loginPage({ error: lockedUntil ? "Too many wrong passwords. Try again in 15 minutes." : "Wrong password." }), 401);
}
