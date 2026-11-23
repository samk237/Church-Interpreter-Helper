import { addCustomWord, deleteCustomWord, getGlossary, listBadge, wordLists } from "./state.js";
import { download, h } from "./dom.js";

const $ = (id) => document.getElementById(id);
const RENDER_LIMIT = 400;

export function initGlossaryView() {
  const filter = $("glossaryListFilter");
  filter.append(h("option", { value: "all" }, "All lists"));
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
  results.sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
  $("glossaryCount").textContent = `${results.length} of ${g.size} words`;

  const table = $("glossaryTable");
  table.innerHTML = "";
  for (const e of results.slice(0, RENDER_LIMIT)) {
    table.append(
      h(
        "div",
        { class: "g-row" },
        h("div", { class: "g-ko" }, e.ko, e.star ? h("span", { class: "star" }, " ★") : null, e.alts.length ? h("div", { class: "entry-alt" }, e.alts.join(", ")) : null),
        h(
          "div",
          { class: "g-en" },
          e.senses.map((s) => h("div", {}, s.en, ...s.lists.map((l) => h("span", { class: "badge" }, listBadge(l))))),
          ...[...new Set(e.senses.map((s) => s.note).filter(Boolean))].map((n) => h("div", { class: "note" }, "ⓘ ", n))
        ),
        e.custom
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
