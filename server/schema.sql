-- Website storage (Cloudflare D1). Applied by `npm run web:setup`; the app also creates `items` on first use.
-- items: your words, flashcard progress, decks, sessions and settings — one row per item,
-- v = JSON (NULL = deleted), t = time of the last change in ms (the newest change wins).
CREATE TABLE IF NOT EXISTS items (
  c TEXT NOT NULL,
  id TEXT NOT NULL,
  v TEXT,
  t INTEGER NOT NULL,
  PRIMARY KEY (c, id)
);
-- Sign-in rate limiting.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
-- Used by the first website version (words were one JSON row); absorbed into `items` automatically.
CREATE TABLE IF NOT EXISTS store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT
);
