import { listBadge, settings } from "./state.js";

/** Tiny element builder: h("div", { class: "x", onclick }, "text", child) — text is always escaped. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Plain snapshot of an entry, safe to store in session transcripts. */
export function snapshot(entry) {
  return {
    ko: entry.ko,
    alts: entry.alts,
    star: entry.star,
    ai: Boolean(entry.ai),
    senses: entry.senses.map((s) => ({ en: s.en, note: s.note, lists: s.lists })),
  };
}

export function renderEntry(entry) {
  const notes = entry.senses.map((s) => s.note).filter(Boolean);
  return h(
    "div",
    { class: "entry" },
    h(
      "div",
      { class: "entry-head" },
      h("span", { class: "entry-ko" }, entry.ko),
      entry.star ? h("span", { class: "star", title: "Marked important" }, "★") : null,
      entry.alts?.length ? h("span", { class: "entry-alt" }, `also: ${entry.alts.join(", ")}`) : null
    ),
    h(
      "ul",
      { class: "senses" },
      entry.senses.map((s) => h("li", {}, s.en, ...s.lists.map((l) => h("span", { class: l === "ai" ? "badge ai" : "badge" }, listBadge(l)))))
    ),
    ...[...new Set(notes)].map((n) => h("div", { class: "note" }, "ⓘ ", n))
  );
}

export function renderPassages(payload, { compact = false } = {}) {
  const wrap = h("div", { class: "passages" });
  for (const p of payload.passages) {
    const verses = h(
      "div",
      { class: `verses lang-${settings.verseLang}` },
      p.verses.map((v) =>
        h(
          "div",
          { class: "verse" },
          h("span", { class: "vnum" }, p.segments.length > 1 || p.verses.some((x) => x.chapter !== p.verses[0].chapter) ? `${v.chapter}:${v.verse}` : v.verse),
          h("span", { class: "en" }, v.en || "—"),
          h("span", { class: "ko" }, v.ko || "—")
        )
      )
    );
    const copyBtn = compact
      ? null
      : h(
          "button",
          {
            class: "ghost-btn small",
            onclick: (e) => {
              const text = [p.reference, ...p.verses.map((v) => `${v.verse} ${settings.verseLang === "ko" ? v.ko : v.en}`)].join("\n");
              navigator.clipboard?.writeText(text);
              e.target.textContent = "Copied";
              setTimeout(() => (e.target.textContent = "Copy"), 1200);
            },
          },
          "Copy"
        );
    wrap.append(
      h(
        "div",
        { class: "passage" },
        compact
          ? null
          : h(
              "div",
              { class: "passage-head" },
              h("span", { class: "passage-ref" }, p.reference, h("span", { class: "ko" }, p.referenceKo)),
              copyBtn
            ),
        verses
      )
    );
  }
  if (!compact) {
    for (const w of payload.warnings ?? []) wrap.append(h("div", { class: "note" }, w));
    const credits = [payload.english, payload.korean].filter(Boolean).map((t) => `${t.short}: ${t.credit}`);
    wrap.append(h("div", { class: "credit" }, credits.join("  ·  ")));
  }
  return wrap;
}

export function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
