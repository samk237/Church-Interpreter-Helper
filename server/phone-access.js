/**
 * Phone access: lets the interpreter open the app on their phone over the same Wi-Fi,
 * without letting anyone else on that network in.
 *
 * - Requests from the Mac itself (loopback) are always allowed.
 * - Other devices need the access code once: by scanning the QR code (URL contains ?key=CODE)
 *   or typing the code on the unlock page. A long-lived cookie remembers the device.
 * - Wrong codes are rate-limited per IP.
 *
 * Server-only module (not served to browsers).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const CODE_LENGTH = 8;
const COOKIE = "cih_access";
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;

export function normalizeCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH * 2);
  let out = "";
  for (const b of bytes) {
    // rejection sampling: 248 = 31 * 8, avoids modulo bias
    if (b < 248) out += ALPHABET[b % ALPHABET.length];
    if (out.length === CODE_LENGTH) break;
  }
  return out.length === CODE_LENGTH ? out : generateCode();
}

/** Keep the same code across restarts so the phone's home-screen icon keeps working. */
export function loadOrCreateCode(file) {
  try {
    const existing = normalizeCode(fs.readFileSync(file, "utf8"));
    if (existing.length === CODE_LENGTH && [...existing].every((c) => ALPHABET.includes(c))) return existing;
  } catch {
    /* no file yet */
  }
  const code = generateCode();
  fs.writeFileSync(file, `${code}\n`, { mode: 0o600 });
  return code;
}

export function codesMatch(a, b) {
  const x = Buffer.from(normalizeCode(a));
  const y = Buffer.from(normalizeCode(b));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

export function isLoopback(req) {
  const a = req.socket?.remoteAddress ?? "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

export function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

function readCookie(req, name) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function setAccessCookie(res, code) {
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
}

/**
 * @returns {{ middleware, unlockHandler, isAuthed(req): boolean }}
 *   middleware: gate for every request (mount before static files)
 */
export function createPhoneGate({ code, publicPaths = [] }) {
  const attempts = new Map(); // ip -> { fails, until }

  const locked = (ip) => {
    const a = attempts.get(ip);
    if (!a) return false;
    if (a.until && a.until > Date.now()) return true;
    if (a.until && a.until <= Date.now()) attempts.delete(ip);
    return false;
  };
  const fail = (ip) => {
    const a = attempts.get(ip) ?? { fails: 0, until: 0 };
    a.fails += 1;
    if (a.fails >= MAX_FAILS) a.until = Date.now() + LOCK_MS;
    attempts.set(ip, a);
  };

  function isAuthed(req) {
    return isLoopback(req) || codesMatch(readCookie(req, COOKIE), code);
  }

  function middleware(req, res, next) {
    req.cihAuthed = isAuthed(req);
    const ip = req.socket?.remoteAddress ?? "?";
    // ?key=CODE (from the QR code) unlocks this device. The key stays in the URL on purpose so
    // "Add to Home Screen" keeps it (home-screen apps on iOS have their own cookie jar).
    if (!req.cihAuthed && req.query?.key !== undefined && !locked(ip)) {
      if (codesMatch(req.query.key, code)) {
        setAccessCookie(res, code);
        attempts.delete(ip);
        req.cihAuthed = true;
      } else {
        fail(ip);
      }
    }
    if (req.cihAuthed || publicPaths.some((p) => (p.endsWith("/") ? req.path.startsWith(p) : req.path === p))) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Locked — enter the access code shown on the Mac." });
    res.status(401).type("html").send(unlockPage({ error: locked(ip) ? "Too many wrong codes. Try again in 15 minutes." : "" }));
  }

  function unlockHandler(req, res) {
    const ip = req.socket?.remoteAddress ?? "?";
    if (locked(ip)) return res.status(429).type("html").send(unlockPage({ error: "Too many wrong codes. Try again in 15 minutes." }));
    if (codesMatch(req.body?.code, code)) {
      attempts.delete(ip);
      setAccessCookie(res, code);
      return res.redirect(303, `/?key=${code}`);
    }
    fail(ip);
    res.status(401).type("html").send(unlockPage({ error: "That code isn't right. Check the code shown on the Mac." }));
  }

  return { middleware, unlockHandler, isAuthed };
}

function unlockPage({ error = "" } = {}) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Interpreter Helper — unlock</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--text:#1b1d22;--muted:#5f6470;--border:#dfe1e6;--accent:#2f5bd3;--err:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#111316;--card:#1a1d22;--text:#eceef2;--muted:#a3a9b5;--border:#2c3038;--accent:#8fb0ff;--err:#ff8a80}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;padding:16px}
form{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;width:min(360px,100%)}
h1{font-size:1.25rem;margin:0 0 6px}p{color:var(--muted);margin:0 0 16px}
input{width:100%;font:inherit;font-size:1.4rem;letter-spacing:.15em;text-transform:uppercase;text-align:center;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
button{margin-top:12px;width:100%;font:inherit;font-weight:600;padding:12px;border:0;border-radius:10px;background:var(--accent);color:#fff}
@media (prefers-color-scheme:dark){button{color:#0d1424}}
.err{color:var(--err);margin:12px 0 0}
</style></head><body>
<form method="post" action="/unlock">
<h1>Interpreter Helper</h1>
<p>Enter the access code shown on your Mac (or scan its QR code).</p>
<input name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" required autofocus>
<button type="submit">Unlock this device</button>
${error ? `<p class="err">${esc(error)}</p>` : ""}
</form></body></html>`;
}
