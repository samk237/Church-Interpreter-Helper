import { addCustomWord, aiReviewCount, confirmAiWord, deleteCustomWord, getGlossary, listBadge, wordLists } from "./state.js";
import { download, h } from "./dom.js";

const $ = (id) => document.getElementById(id);
const RENDER_LIMIT = 400;

export function initGlossaryView() {
  const filter = $("glossaryListFilter");
  filter.append(h("option", { value: "all" }, "All lists"));
  filter.append(h("option", { value: "ai", id: "aiFilterOption" }, "🤖 AI — needs review"));
  wordLists.forEach((l) => filter.append(h("option", { value: l.id }, l.title)));
  filter.append(h("option", { value: "custom" }, "My added words"));

  let t;
  $("glossarySearch").addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(renderGlossary, 80);
  });
  filter.addEventListener("change", renderGlossary);
  $("glossaryStarred").addEventListener("change", renderGlossary);

  $("addWordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    try {
      await addCustomWord({ ko: fd.get("ko"), en: fd.get("en"), note: fd.get("note") });
      form.reset();
      $("glossarySearch").value = fd.get("ko");
      renderGlossary();
    } catch (error) {
      alert(error.message);
    }
  });

  $("downloadCsvBtn").addEventListener("click", () => {
    const rows = [["Korean", "English", "Notes", "Lists", "Starred"]];
    for (const e of getGlossary().entries) {
      rows.push([
        e.ko + (e.alts.length ? ` (${e.alts.join(", ")})` : ""),
        e.en,
        [...new Set(e.senses.map((s) => s.note).filter(Boolean))].join(" "),
        e.lists.join(" "),
        e.star ? "★" : "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download("interpreter-glossary.csv", "﻿" + csv, "text/csv");
  });
  $("printGlossaryBtn").addEventListener("click", () => window.print());
  renderGlossary();
}

export function renderGlossary() {
  const g = getGlossary();
  const results = g.search($("glossarySearch").value, {
    list: $("glossaryListFilter").value || "all",
    starredOnly: $("glossaryStarred").checked,
  });
  const opt = document.getElementById("aiFilterOption");
  if (opt) opt.textContent = `🤖 AI — needs review (${aiReviewCount()})`;
  results.sort((a, b) => (b.ai - a.ai) || a.ko.localeCompare(b.ko, "ko")); // unreviewed AI words first
  $("glossaryCount").textContent = `${results.length} of ${g.size} words`;

  const table = $("glossaryTable");
  table.innerHTML = "";
  for (const e of results.slice(0, RENDER_LIMIT)) {
    table.append(
      h(
        "div",
        { class: e.ai ? "g-row ai" : "g-row" },
        h("div", { class: "g-ko" }, e.ko, e.star ? h("span", { class: "star" }, " ★") : null, e.alts.length ? h("div", { class: "entry-alt" }, e.alts.join(", ")) : null),
        h(
          "div",
          { class: "g-en" },
          e.senses.map((s) => h("div", {}, s.en, ...s.lists.map((l) => h("span", { class: l === "ai" ? "badge ai" : "badge" }, listBadge(l))))),
          ...[...new Set(e.senses.map((s) => s.note).filter(Boolean))].map((n) => h("div", { class: "note" }, "ⓘ ", n))
        ),
        e.ai ? reviewActions(e) : e.custom
          ? h(
              "button",
              {
                class: "del-btn",
                onclick: async () => {
                  if (confirm(`Remove “${e.ko}” from your added words?`)) await deleteCustomWord(e.ko);
                },
              },
              "Remove"
            )
          : h("span")
      )
    );
  }
  if (results.length > RENDER_LIMIT) {
    table.append(h("p", { class: "muted small center" }, `Showing ${RENDER_LIMIT} — search to narrow down.`));
  }
}

/** Review an AI-suggested word: confirm it, fix it, or throw it away. */
function reviewActions(e) {
  const wrap = h("div", { class: "review-actions" });
  wrap.append(
    h("button", { class: "ghost-btn small grade-easy", title: "Correct — keep permanently", onclick: () => confirmAiWord(e.ko) }, "✓"),
    h(
      "button",
      {
        class: "ghost-btn small",
        title: "Fix the meaning or spelling",
        onclick: () => {
          const row = wrap.closest(".g-row");
          const form = h(
            "form",
            {
              class: "inline-form review-edit",
              onsubmit: async (ev) => {
                ev.preventDefault();
                const fd = new FormData(form);
                await addCustomWord({ ko: fd.get("ko"), en: fd.get("en"), note: fd.get("note"), replaces: e.ko });
              },
            },
            h("input", { name: "ko", value: e.ko, required: true }),
            h("input", { name: "en", value: e.en, required: true }),
            h("input", { name: "note", value: "", placeholder: "note (optional)" }),
            h("button", { class: "pill-btn small", type: "submit" }, "Save as correct")
          );
          row.append(form);
          form.querySelector("[name=en]").focus();
        },
      },
      "Edit"
    ),
    h("button", { class: "ghost-btn small grade-again", title: "Wrong — delete", onclick: () => deleteCustomWord(e.ko) }, "✗")
  );
  return wrap;
}
