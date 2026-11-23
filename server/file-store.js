/**
 * Mac mode storage: all your data in one JSON file (data/my-data.json, never committed).
 * Same item model as the website (see server/core/user-data.js), so `npm run sync` can merge the two.
 * The file is re-read on every call, so a sync that runs while the Mac server is up is picked up.
 */
import fs from "node:fs";
import path from "node:path";
import { isNewer, wordItems } from "./core/user-data.js";

export function createFileStore(file, { legacyWordsFile } = {}) {
  function read() {
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, items: {} };
      throw error;
    }
    // A damaged file throws instead of being treated as empty, so nothing gets overwritten.
    const data = JSON.parse(raw);
    if (!data || typeof data.items !== "object") throw new Error(`${file} is not a data file`);
    return data;
  }

  function write(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1) + "\n");
    fs.renameSync(tmp, file);
  }

  /** Apply items (newest change wins). Values are kept as plain JSON in the file so it stays readable. */
  function apply(data, items) {
    let changed = 0;
    for (const it of items) {
      const col = (data.items[it.c] ??= {});
      if (!isNewer(it, col[it.id])) continue;
      col[it.id] = { v: it.v === null ? null : JSON.parse(it.v), t: it.t };
      changed += 1;
    }
    return changed;
  }

  // Words saved by older versions (data/custom-words.json) are absorbed once; the old file is kept as *.imported.json.
  if (legacyWordsFile && fs.existsSync(legacyWordsFile)) {
    const words = JSON.parse(fs.readFileSync(legacyWordsFile, "utf8"));
    if (Array.isArray(words) && words.length) {
      const data = read();
      apply(data, wordItems(words));
      write(data);
      fs.renameSync(legacyWordsFile, legacyWordsFile.replace(/\.json$/, ".imported.json"));
    }
  }

  return {
    file,
    async list({ collections } = {}) {
      const out = [];
      for (const [c, col] of Object.entries(read().items)) {
        if (collections && !collections.includes(c)) continue;
        for (const [id, it] of Object.entries(col)) out.push({ c, id, v: it.v === null ? null : JSON.stringify(it.v), t: it.t });
      }
      return out;
    },
    async put(items) {
      if (!items.length) return 0;
      const data = read();
      const changed = apply(data, items);
      if (changed) write(data);
      return changed;
    },
  };
}
