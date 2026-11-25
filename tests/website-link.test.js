import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onRequest } from "../functions/_middleware.js";
import { createFileStore } from "../server/file-store.js";
import { createD1Store } from "../server/web/d1-store.js";
import { createWebsiteLink, describeItems, LinkError, mergeStores } from "../server/website-link.js";
import { fakeD1 } from "./fake-d1.js";

const item = (c, id, v, t) => ({ c, id, v: v === null ? null : JSON.stringify(v), t });
const ids = (items) => items.map((i) => `${i.c}/${i.id}`).sort();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cih-link-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("npm run sync", () => {
  it("a dry run changes nothing, not even the website's one-time upgrade", async () => {
    const db = fakeD1();
    db.raw.exec("CREATE TABLE items (c TEXT NOT NULL, id TEXT NOT NULL, v TEXT, t INTEGER NOT NULL, PRIMARY KEY (c, id))");
    db.raw.prepare("INSERT INTO store (key, value) VALUES ('custom-words', ?)").run(JSON.stringify([{ ko: "심방", en: "home visitation" }]));
    const mac = createFileStore(path.join(dir, "my-data.json"));
    await mac.put([item("sessions", "s1", { id: "s1" }, 5)]);

    const { toWeb } = await mergeStores(mac, createD1Store(db, { readOnly: true }), { dryRun: true });
    expect(ids(toWeb)).toEqual(["sessions/s1"]);
    expect(db.raw.prepare("SELECT count(*) AS n FROM items").get().n).toBe(0);
    expect(db.raw.prepare("SELECT count(*) AS n FROM store").get().n).toBe(1);
  });

  it("describes what moved", () => {
    expect(describeItems([item("words", "a", {}, 1), item("words", "b", {}, 1), item("sessions", "s", {}, 1)])).toBe("2 words, 1 session");
  });
});

describe("Mac mode's automatic website sync", () => {
  const setup = (opts = {}) => {
    const mac = createFileStore(path.join(dir, "my-data.json"));
    const web = createD1Store(fakeD1());
    const logs = [];
    const link = createWebsiteLink({ local: mac, connect: async () => web, log: (m) => logs.push(m), minGapMs: 50, pushDelayMs: 10, ...opts });
    return { mac, web, link, logs };
  };

  it("merges both ways when it starts", async () => {
    const { mac, web, link, logs } = setup();
    await mac.put([item("sessions", "laptop", { id: "laptop" }, 10)]);
    await web.put([item("sessions", "phone", { id: "phone" }, 20), item("words", "희년", { ko: "희년", en: "Jubilee" }, 20)]);
    await link.start();
    expect(ids(await mac.list())).toEqual(["sessions/laptop", "sessions/phone", "words/희년"]);
    expect(ids(await web.list())).toEqual(["sessions/laptop", "sessions/phone", "words/희년"]);
    expect(link.status().state).toBe("synced");
    expect(logs.join("\n")).toMatch(/↓ 1 word, 1 session from the website, ↑ 1 session to the website/);
  });

  it("catches up before answering the app, at most every few seconds", async () => {
    const { mac, web, link } = setup();
    await link.start();
    await web.put([item("words", "구제", { ko: "구제", en: "relief" }, 30)]);
    await link.fresh(); // too soon after the last merge: answers from the Mac's copy
    expect(ids(await mac.list())).toEqual([]);
    await sleep(60);
    await link.fresh(); // a phone's new word shows up on the Mac
    expect(ids(await mac.list())).toEqual(["words/구제"]);
  });

  it("passes changes saved on the Mac to the website", async () => {
    const { mac, web, link } = setup();
    await link.start();
    await mac.put([item("progress", "w:1", { box: 2 }, 40)]);
    link.changed();
    await sleep(80);
    expect(ids(await web.list())).toEqual(["progress/w:1"]);
  });

  it("keeps working when the website can't be reached, says why once, and recovers", async () => {
    let online = false;
    const web = createD1Store(fakeD1());
    const mac = createFileStore(path.join(dir, "my-data.json"));
    const logs = [];
    const link = createWebsiteLink({
      local: mac,
      connect: async () => {
        if (!online) throw new TypeError("fetch failed");
        return web;
      },
      log: (m) => logs.push(m),
      minGapMs: 0,
    });
    await mac.put([item("decks", "d1", { id: "d1" }, 5)]);
    await link.start();
    await link.fresh();
    expect(link.status()).toMatchObject({ state: "paused", message: expect.stringMatching(/offline/) });
    expect(logs.filter((l) => l.includes("paused"))).toHaveLength(1);
    online = true;
    await link.fresh();
    expect(link.status().state).toBe("synced");
    expect(ids(await web.list())).toEqual(["decks/d1"]);
  });

  it("explains sign-in problems in plain words", async () => {
    const link = createWebsiteLink({
      local: createFileStore(path.join(dir, "my-data.json")),
      connect: async () => {
        throw new LinkError("Not signed in to Cloudflare, or offline. To sign in, run: npx wrangler login");
      },
      log: () => {},
    });
    await link.start();
    expect(link.status().message).toMatch(/wrangler login/);
  });

  it("never waits long for a slow connection", async () => {
    const link = createWebsiteLink({
      local: createFileStore(path.join(dir, "my-data.json")),
      connect: () => new Promise(() => {}), // hangs
      log: () => {},
      waitMs: 30,
    });
    const started = Date.now();
    await link.fresh();
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("website addresses", () => {
  const call = (url, env = {}) => onRequest({ request: new Request(url), env, next: () => new Response("app") });

  it("sends a publish's frozen address to the main address", async () => {
    const r = await call("https://1a2b3c4d.interpreter-helper.pages.dev/js/app.js?x=1");
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://interpreter-helper.pages.dev/js/app.js?x=1");
  });

  it("serves the main address as usual", async () => {
    const r = await call("https://interpreter-helper.pages.dev/", { APP_PASSWORD: "pw" });
    expect(r.status).toBe(401); // sign-in page
  });
});
