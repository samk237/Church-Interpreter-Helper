import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSyncItems, planSync, wordItems } from "../server/core/user-data.js";
import * as api from "../server/core/user-data-api.js";
import { createFileStore } from "../server/file-store.js";
import { chunkItems, createD1Store } from "../server/web/d1-store.js";

// Node's built-in SQLite (loaded with require because Vite doesn't know this newer built-in module).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

/** A D1-shaped wrapper around real SQLite (what D1 runs), so the website's SQL is tested for real. */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)");
  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => db.prepare(sql).run(...params),
  });
  return {
    raw: db,
    prepare: (sql) => statement(sql),
    batch: async (stmts) => {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

const item = (c, id, v, t) => ({ c, id, v: v === null ? null : JSON.stringify(v), t });
const T = (iso) => new Date(iso);

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cih-data-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const stores = {
  "Mac file": () => createFileStore(path.join(dir, "my-data.json")),
  "website D1": () => createD1Store(fakeD1()),
};

describe("sync rules", () => {
  it("validates what browsers send", () => {
    const now = 1_000_000;
    expect(parseSyncItems({ items: [item("progress", "w:1", { box: 2 }, 5)] }, { now }).items).toHaveLength(1);
    expect(parseSyncItems({ items: [item("words", "x", {}, 5)] }, { now }).error).toMatch(/collection/); // words have their own API
    expect(parseSyncItems({ items: [{ c: "decks", id: "d", v: "{bad", t: 5 }] }, { now }).error).toMatch(/JSON/);
    expect(parseSyncItems({ items: [{ c: "decks", id: "", v: null, t: 5 }] }, { now }).error).toBeTruthy();
    expect(parseSyncItems({ nope: 1 }).error).toBeTruthy();
    // A device with a clock far in the future can't win forever.
    expect(parseSyncItems({ items: [item("prefs", "settings", {}, now + 10 * 86400000)] }, { now }).items[0].t).toBe(now + 86400000);
  });

  it("plans a two-way merge where the newest change wins and deletions stick", () => {
    const mac = [item("words", "희년", { ko: "희년", en: "Jubilee" }, 10), item("progress", "w:a", { box: 1 }, 50), item("decks", "d1", null, 40)];
    const web = [item("words", "희년", { ko: "희년", en: "Year of Jubilee" }, 20), item("progress", "w:a", { box: 3 }, 30), item("decks", "d1", { id: "d1" }, 35), item("sessions", "s1", { id: "s1" }, 5)];
    const { toA: toMac, toB: toWeb } = planSync(mac, web);
    expect(toMac.map((i) => `${i.c}/${i.id}`).sort()).toEqual(["sessions/s1", "words/희년"]);
    expect(toWeb.map((i) => `${i.c}/${i.id}`).sort()).toEqual(["decks/d1", "progress/w:a"]);
    expect(toWeb.find((i) => i.c === "decks").v).toBeNull(); // the Mac's deletion is newer
  });

  it("splits big uploads into chunks that fit in one statement", () => {
    const big = "x".repeat(700_000);
    const chunks = chunkItems([1, 2, 3].map((n) => item("sessions", `s${n}`, { big }, n)));
    expect(chunks.length).toBe(2);
    expect(chunks.flat()).toHaveLength(3);
  });
});

for (const [name, make] of Object.entries(stores)) {
  describe(`${name} store`, () => {
    it("keeps the newest change per item", async () => {
      const store = make();
      await store.put([item("progress", "w:a", { box: 1 }, 10), item("decks", "d1", { id: "d1" }, 10)]);
      await store.put([item("progress", "w:a", { box: 0 }, 5), item("decks", "d1", null, 20), item("progress", "w:한글", { box: 2 }, 7)]);
      const all = await store.list();
      const get = (c, id) => all.find((i) => i.c === c && i.id === id);
      expect(JSON.parse(get("progress", "w:a").v)).toEqual({ box: 1 }); // older change ignored
      expect(get("decks", "d1")).toMatchObject({ v: null, t: 20 }); // deletion kept with its time
      expect(JSON.parse(get("progress", "w:한글").v)).toEqual({ box: 2 });
      expect((await store.list({ collections: ["decks"] })).map((i) => i.id)).toEqual(["d1"]);
    });

    it("runs the word rules: add, AI never overwrites, confirm, rename, delete", async () => {
      const store = make();
      await api.postWord(store, { ko: "심방", en: "home visitation", status: "ai" }, T("2026-11-01T00:00:00Z"));
      await api.postWord(store, { ko: "심방", en: "something else", status: "ai" }, T("2026-11-02T00:00:00Z"));
      let { body } = await api.getWords(store);
      expect(body.words).toMatchObject([{ ko: "심방", en: "home visitation", status: "ai" }]);

      await api.postWord(store, { ko: "심방", en: "pastoral visit" }, T("2026-11-03T00:00:00Z")); // confirm with an edit
      ({ body } = await api.postWord(store, { ko: "심방예배", en: "pastoral visit", replaces: "심방" }, T("2026-11-04T00:00:00Z")));
      expect(body.words.map((w) => w.ko)).toEqual(["심방예배"]);
      const tomb = (await store.list({ collections: ["words"] })).find((i) => i.id === "심방");
      expect(tomb.v).toBeNull(); // the rename leaves a deletion so other devices drop the old spelling too

      expect((await api.postWord(store, { ko: "", en: "x" })).status).toBe(400);
      await api.deleteWord(store, "심방예배", T("2026-11-05T00:00:00Z"));
      expect((await api.getWords(store)).body.words).toEqual([]);
    });

    it("doesn't re-add an AI word you rejected, but you can still add it yourself", async () => {
      const store = make();
      await api.postWord(store, { ko: "구재", en: "relief", status: "ai" }, T("2026-11-01T00:00:00Z"));
      await api.deleteWord(store, "구재", T("2026-11-02T00:00:00Z"));
      await api.postWord(store, { ko: "구재", en: "relief", status: "ai" }, T("2026-11-03T00:00:00Z"));
      expect((await api.getWords(store)).body.words).toEqual([]);
      await api.postWord(store, { ko: "구재", en: "relief" }, T("2026-11-04T00:00:00Z"));
      expect((await api.getWords(store)).body.words).toMatchObject([{ ko: "구재", status: "confirmed" }]);
    });

    it("serves everything except words on /api/sync and checks uploads", async () => {
      const store = make();
      await api.postWord(store, { ko: "희년", en: "Jubilee" });
      expect((await api.postSync(store, { items: [item("progress", "w:1", { box: 2 }, 5)] })).status).toBe(200);
      expect((await api.postSync(store, { items: [item("words", "x", {}, 5)] })).status).toBe(400);
      const { body } = await api.getSync(store);
      expect(body.items.map((i) => i.c)).toEqual(["progress"]);
    });
  });
}

describe("upgrading from earlier versions", () => {
  it("Mac: absorbs data/custom-words.json once and keeps it as *.imported.json", async () => {
    const legacy = path.join(dir, "custom-words.json");
    fs.writeFileSync(legacy, JSON.stringify([{ ko: "희년", en: "Jubilee", note: "", status: "confirmed", addedAt: "2026-10-01T00:00:00Z" }]));
    const store = createFileStore(path.join(dir, "my-data.json"), { legacyWordsFile: legacy });
    expect((await api.getWords(store)).body.words).toMatchObject([{ ko: "희년", en: "Jubilee" }]);
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(path.join(dir, "custom-words.imported.json"))).toBe(true);
  });

  it("Mac: a damaged data file is never overwritten", async () => {
    const file = path.join(dir, "my-data.json");
    fs.writeFileSync(file, "{ not json");
    const store = createFileStore(file);
    await expect(store.put([item("progress", "a", {}, 1)])).rejects.toThrow();
    expect(fs.readFileSync(file, "utf8")).toBe("{ not json");
  });

  it("website: absorbs the first version's word list row and removes it", async () => {
    const db = fakeD1();
    const words = [{ ko: "심방", en: "home visitation", status: "ai", addedAt: "2026-11-20T00:00:00Z" }];
    db.raw.prepare("INSERT INTO store (key, value) VALUES ('custom-words', ?)").run(JSON.stringify(words));
    const store = createD1Store(db);
    expect((await api.getWords(store)).body.words).toMatchObject([{ ko: "심방", status: "ai" }]);
    expect(db.raw.prepare("SELECT count(*) AS n FROM store").get().n).toBe(0);
  });

  it("Mac ↔ website sync converges both ways", async () => {
    const mac = createFileStore(path.join(dir, "my-data.json"));
    const web = createD1Store(fakeD1());
    await mac.put([...wordItems([{ ko: "희년", en: "Jubilee", addedAt: "2026-11-01T00:00:00Z" }]), item("progress", "w:1", { box: 1 }, 100)]);
    await web.put([item("progress", "w:1", { box: 4 }, 200), item("sessions", "s1", { id: "s1", transcript: [] }, 50)]);
    const { toA, toB } = planSync(await mac.list(), await web.list());
    await mac.put(toA);
    await web.put(toB);
    const sort = (xs) => xs.map((i) => `${i.c}/${i.id}/${i.t}`).sort();
    expect(sort(await mac.list())).toEqual(sort(await web.list()));
    expect(planSync(await mac.list(), await web.list())).toEqual({ toA: [], toB: [] });
  });
});
