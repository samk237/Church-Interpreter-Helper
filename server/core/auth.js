/**
 * Website login: one password (APP_PASSWORD), long-lived signed session cookie.
 * Uses Web Crypto (available in Cloudflare Workers and Node 20+).
 */
const enc = new TextEncoder();

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equalHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Constant-time password check (compares HMACs, so length differences don't leak). */
export async function passwordMatches(given, actual) {
  if (!actual) return false;
  const [a, b] = await Promise.all([hmacHex("pw-check", String(given ?? "")), hmacHex("pw-check", String(actual))]);
  return equalHex(a, b);
}

/** Token = "<expiryMs>.<hmac>". Changing the password (secret) logs every device out. */
export async function makeSessionToken(secret, now = Date.now(), days = 365) {
  const exp = String(now + days * 86400000);
  return `${exp}.${await hmacHex(`session:${secret}`, exp)}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  const [exp, sig] = String(token ?? "").split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return equalHex(sig, await hmacHex(`session:${secret}`, exp));
}

export function readCookie(cookieHeader, name) {
  for (const part of String(cookieHeader ?? "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function loginPage({ error = "" } = {}) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<title>Interpreter Helper — sign in</title>
<style>
:root{--bg:#f6f6f3;--card:#fff;--text:#16181d;--muted:#5b616e;--border:#dcdfe5;--accent:#2f5bd3;--btn:#fff;--err:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#111316;--card:#1a1d22;--text:#eceef2;--muted:#a3a9b5;--border:#2e333b;--accent:#8fb0ff;--btn:#0d1424;--err:#ff8a80}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;padding:16px}
form{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;width:min(360px,100%)}
h1{font-size:1.25rem;margin:0 0 6px}p{color:var(--muted);margin:0 0 16px}
input{width:100%;font:inherit;font-size:16px;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
button{margin-top:12px;width:100%;font:inherit;font-weight:600;padding:12px;border:0;border-radius:10px;background:var(--accent);color:var(--btn)}
.err{color:var(--err);margin:12px 0 0}
</style></head><body>
<form method="post" action="/login">
<h1>Interpreter Helper</h1>
<p>Enter your password. This device stays signed in.</p>
<input type="password" name="password" autocomplete="current-password" required autofocus>
<button type="submit">Sign in</button>
${error ? `<p class="err">${esc(error)}</p>` : ""}
</form></body></html>`;
}
