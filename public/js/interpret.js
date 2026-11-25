import { looksLikeReference, parseReferences, formatReference } from "/lib/reference.js";
import { addCustomWord, confirmAiWord, fetchScripture, getGlossary, load, machineTranslate, save, settings } from "./state.js";
import { getAll, onDataChange, removeItem, setItem } from "./sync.js";
import { isShortTerm } from "/lib/mt-prompt.js";
import { download, h, renderEntry, renderPassages, snapshot } from "./dom.js";

// Up to about one sentence is translated automatically; longer text gets a button (use Claude for paragraphs).
const AUTO_MT_MAX_CHARS = 200;

const $ = (id) => document.getElementById(id);
const chatLog = $("chatLog");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const liveSuggest = $("liveSuggest");
const sessionDialog = $("sessionDialog");

// Sessions are synced across devices (see sync.js); which one is open is remembered per device.
const loadSessions = () =>
  Object.values(getAll("sessions"))
    .map((s) => Object.assign(s, { transcript: s.transcript ?? [] }))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
let sessions = loadSessions();
let activeSessionId = load("cih.activeSession", null);
if (!sessions.some((s) => s.id === activeSessionId)) activeSessionId = sessions[sessions.length - 1]?.id ?? null;

const saveSession = (s) => s && setItem("sessions", s.id, s);
const sessionOf = (msg) => sessions.find((s) => s.transcript.includes(msg)) ?? activeSession();
const activeSession = () => sessions.find((s) => s.id === activeSessionId) ?? null;

export function initInterpret() {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submit(chatInput.value);
  });
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
    if (e.key === "Escape") hideSuggest();
  });
  let t;
  chatInput.addEventListener("input", () => {
    autoResize();
    clearTimeout(t);
    t = setTimeout(updateSuggest, 60);
  });
  $("manageSessionsBtn").addEventListener("click", openSessionDialog);
  // Tap the session's name to rename it (or change its passage / speaker).
  $("sessionTitle").addEventListener("click", () => {
    openSessionDialog();
    if (activeSession()) startEditing(activeSession());
  });
  sessionDialog.addEventListener("close", resetSessionForm);
  $("createSessionBtn").addEventListener("click", onCreateSession);
  $("exportSessionBtn").addEventListener("click", exportSession);
  $("sessionScripture").addEventListener("click", () => {
    const s = activeSession();
    if (s?.scripture) submit(s.scripture);
  });
  // Sessions from another device (or this one, last time) arrived: show them.
  onDataChange((changed) => {
    if (!changed.has("sessions")) return;
    sessions = loadSessions();
    if (!sessions.some((s) => s.id === activeSessionId)) activeSessionId = sessions[sessions.length - 1]?.id ?? null;
    renderAll();
  });
  renderAll();
  if (!activeSessionId) openSessionDialog();
}

// ---------------------------------------------------------------------------
// Submit / process
// ---------------------------------------------------------------------------
async function submit(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return;
  hideSuggest();
  chatInput.value = "";
  autoResize();
  if (!activeSession()) createSession({ title: `Session ${new Date().toLocaleDateString()}` });

  pushMessage({ role: "user", text });

  if (looksLikeReference(text)) {
    const bubble = appendBubble("assistant", h("span", { class: "muted" }, "Looking up passage…"));
    try {
      const payload = await fetchScripture(text);
      const data = { type: "scripture", query: text, payload };
      fillBubble(bubble, data);
      persist({ role: "assistant", data, text: plainScripture(payload) });
    } catch (error) {
      const data = { type: "error", message: error.message };
      fillBubble(bubble, data);
      persist({ role: "assistant", data, text: error.message });
    }
    return;
  }

  const data = buildLookupData(text);
  const bubble = appendBubble("assistant", renderResult(data));
  const msg = persist({ role: "assistant", data, text: plainLookup(data) });
  scrollToBottom();

  if (settings.autoMt && needsMt(data) && text.length <= AUTO_MT_MAX_CHARS) {
    await runMt(data, bubble, msg);
  }
}

function buildLookupData(text) {
  const g = getGlossary();
  const r = g.lookup(text);
  const counts = new Map();
  const found = [];
  for (const m of r.found) {
    const key = m.entry.id;
    if (counts.has(key)) counts.get(key).count += 1;
    else {
      const item = { text: m.text, entry: snapshot(m.entry), count: 1 };
      counts.set(key, item);
      found.push(item);
    }
  }
  return {
    type: "lookup",
    query: text,
    language: r.language,
    long: text.length > 40 || text.includes("\n"),
    sentence: text.length > 40 || text.includes("\n") || text.trim().split(/\s+/).length >= 3,
    exact: r.exact.map(snapshot),
    found,
    suggestions: r.suggestions.map((e) => ({ ko: e.ko, en: e.en })),
    mt: null,
  };
}

// Machine-translate only when your lists didn't fully answer it (single words matched via conjugation count as answered).
const needsMt = (data) => data.exact.length === 0 && (data.found.length === 0 || data.sentence || data.long);

async function runMt(data, bubble, msg) {
  const hints = [...data.exact, ...data.found.map((f) => f.entry)].map((e) => ({ ko: e.ko, en: e.senses[0]?.en ?? "" }));
  data.mt = { loading: true };
  fillBubble(bubble, data);
  try {
    const r = await machineTranslate(data.query, data.language, hints);
    const g = getGlossary();
    const suggestions = (r.suggestions ?? []).map((s) => {
      const entry = data.language === "ko" ? g.get(s.term) : null;
      return { term: s.term, translation: s.translation, entry: entry ? snapshot(entry) : null };
    });
    const glossaryEntry = suggestions.find((s) => s.entry)?.entry ?? null; // AI's guess is a word you already have
    data.mt = { text: r.translatedText, provider: r.provider, corrected: r.corrected ?? null, suggestions, glossaryEntry, saved: null };
    if (!glossaryEntry && !data.sentence && !data.long && isShortTerm(data.query)) data.mt.saved = await saveAiWord(data, r);
  } catch (error) {
    data.mt = { error: error.message };
  }
  fillBubble(bubble, data);
  msg.text = plainLookup(data);
  saveSession(sessionOf(msg));
}

/** Single-word AI answers go to the Glossary as "AI · unreviewed" so you can check them later. */
async function saveAiWord(data, r) {
  const isKo = data.language === "ko";
  const ko = isKo ? r.corrected ?? data.query : r.translatedText.split(" / ")[0].trim();
  const en = isKo ? r.translatedText : r.corrected ?? data.query;
  if (!ko || !en || getGlossary().get(ko)) return null;
  const note = isKo
    ? `AI suggestion (${r.provider})${r.corrected ? ` — you typed “${data.query}”` : ""}`
    : `AI suggestion (${r.provider}) from English “${en}”: ${r.translatedText}`;
  try {
    await addCustomWord({ ko, en, note, alt: isKo && r.corrected ? [data.query] : undefined, status: "ai" });
    return { ko, en };
  } catch {
    return null; // saving is a convenience — never block the answer
  }
}

// ---------------------------------------------------------------------------
// Rendering results
// ---------------------------------------------------------------------------
function renderResult(data) {
  if (data.type === "scripture") {
    return h("div", {}, h("div", { class: "source-label scripture" }, `📖 ${data.payload.english?.short ?? "English"} · ${data.payload.korean?.short ?? "Korean"}`), renderPassages(data.payload));
  }
  if (data.type === "error") return h("div", { class: "note" }, data.message);
  if (data.type !== "lookup") return h("div", {}, data.text ?? "");

  const box = h("div", {});
  const hasGlossary = data.exact.length || data.found.length;
  const sentence = Boolean(data.sentence || data.long);

  // A sentence: the translation is the main answer, your terms go underneath.
  if (sentence && !data.exact.length) {
    box.append(renderMt(data, { sentence: true }));
    if (data.found.length) {
      box.append(h("div", { class: "source-label glossary", style: "margin-top:12px" }, `✓ Your terms in this sentence (${data.found.length})`));
      box.append(renderFoundTable(data));
      if (data.long) {
        box.append(h("div", { class: "row-actions" }, h("button", { class: "ghost-btn small", onclick: (e) => makeDeck(data, e.target) }, "Make flashcards from these")));
      }
    }
    return box;
  }

  if (data.exact.length) {
    if (data.exact.every((e) => e.ai)) {
      box.append(h("div", { class: "source-label mt" }, "🤖 AI suggestion saved earlier — not reviewed yet"));
      data.exact.forEach((e) => box.append(renderEntry(e)));
      box.append(reviewButtons(data.exact[0]));
    } else {
      box.append(h("div", { class: "source-label glossary" }, "✓ Your word lists"));
      data.exact.forEach((e) => box.append(renderEntry(e)));
    }
  } else if (data.found.length > 1 || (data.found.length && data.language === "en")) {
    box.append(h("div", { class: "source-label glossary" }, `✓ ${data.found.length} word${data.found.length > 1 ? "s" : ""} from your lists`));
    box.append(renderFoundTable(data));
  } else if (data.found.length) {
    box.append(h("div", { class: "source-label glossary" }, `✓ Matched “${data.found[0].text}” in your lists`));
    data.found.forEach((f) => box.append(renderEntry(f.entry)));
  } else {
    box.append(h("div", { class: "source-label none" }, "Not in your word lists"));
  }

  if (data.suggestions.length) {
    box.append(
      h(
        "div",
        { class: "live-suggest", style: "padding:8px 0 0" },
        h("span", { class: "muted small" }, hasGlossary ? "Related:" : "Did you mean:"),
        data.suggestions.map((s) => h("button", { class: "chip", onclick: () => submit(s.ko) }, h("b", {}, s.ko), h("span", { class: "en" }, trim(s.en, 32))))
      )
    );
  }

  if (!data.exact.length) box.append(renderMt(data, { sentence: false }));
  return box;
}

function renderFoundTable(data) {
  return h(
    "table",
    { class: "scan-table" },
    data.found.map((f) =>
      h(
        "tr",
        {},
        h("td", {}, f.entry.ko, f.count > 1 ? h("span", { class: "count" }, ` ×${f.count}`) : null),
        h(
          "td",
          {},
          f.entry.senses.map((s) => s.en).join(" · "),
          f.entry.ai ? h("span", { class: "badge ai" }, "AI · unreviewed") : null,
          ...[...new Set(f.entry.senses.map((s) => s.note).filter(Boolean))].map((n) => h("div", { class: "note" }, "ⓘ ", n))
        )
      )
    )
  );
}

/** The AI box — always visually separate from your glossary. */
function renderMt(data, { sentence }) {
  const mt = data.mt;
  if (mt?.loading) return h("div", { class: "mt-box" }, h("span", { class: "muted small" }, sentence ? "AI is translating…" : "Asking AI…"));

  if (mt?.text) {
    const box = h("div", { class: "mt-box" });
    const suggestions = mt.suggestions ?? (mt.corrected ? [{ term: mt.corrected }] : []);
    box.append(
      h(
        "div",
        { class: "source-label mt", title: `AI model: ${mt.provider}` },
        sentence ? "🤖 AI translation (uses your terms) — verify" : "🤖 AI suggestion — verify"
      )
    );
    if (mt.glossaryEntry) {
      // The AI thinks you meant a word that's already in your lists: show YOUR entry.
      box.append(h("div", { class: "muted small" }, "Did you mean ", h("b", {}, mt.glossaryEntry.ko), "? It's in your word lists:"));
      box.append(renderEntry(mt.glossaryEntry));
      return box;
    }
    if (suggestions.length) {
      box.append(
        h(
          "div",
          { class: "live-suggest", style: "padding:0 0 6px" },
          h("span", { class: "muted small" }, data.language === "ko" ? "Did you mean (AI guess):" : "Did you mean:"),
          suggestions.map((s) =>
            h("button", { class: "chip", onclick: () => submit(s.term) }, h("b", {}, s.term), s.translation ? h("span", { class: "en" }, trim(s.translation, 30)) : null)
          )
        )
      );
    }
    box.append(h("div", { class: "mt-text" }, mt.corrected && data.language === "ko" ? `${mt.corrected}: ${mt.text}` : mt.text));
    if (mt.saved) {
      box.append(h("div", { class: "muted small", style: "margin-top:6px" }, "Saved to Glossary for review later — or confirm now:"));
      box.append(reviewButtons({ ko: mt.saved.ko, en: mt.saved.en, senses: [{ en: mt.saved.en, note: "" }] }));
    } else if (!sentence) {
      box.append(saveWordControls(data));
    }
    return box;
  }

  if (mt?.error) {
    return h("div", { class: "mt-box" }, h("span", { class: "muted small" }, `AI fallback unavailable: ${mt.error}`), sentence ? null : saveWordControls(data));
  }

  return h(
    "div",
    { class: "row-actions" },
    h(
      "button",
      {
        class: "ghost-btn small",
        onclick: (e) => {
          const bubbleEl = e.target.closest(".chat-bubble");
          runMt(data, bubbleEl, findMsgForBubble(bubbleEl) ?? { text: "" });
        },
      },
      sentence ? "Translate sentence (AI)" : "Ask AI"
    ),
    sentence ? null : h("button", { class: "ghost-btn small", onclick: (e) => e.target.replaceWith(saveWordControls(data, true)) }, "Add to my words")
  );
}

/** Optional in-the-moment review of an AI word (otherwise review later in the Glossary tab). */
function reviewButtons(entry) {
  const row = h("div", { class: "row-actions" });
  row.append(
    h(
      "button",
      {
        class: "ghost-btn small grade-easy",
        onclick: async () => {
          await confirmAiWord(entry.ko);
          row.replaceWith(h("div", { class: "source-label glossary" }, "✓ Confirmed — permanent in your glossary"));
        },
      },
      "✓ Correct"
    ),
    h(
      "button",
      {
        class: "ghost-btn small",
        onclick: () => row.replaceWith(editWordForm(entry.ko, entry.senses?.[0]?.en ?? entry.en ?? "", "")),
      },
      "Edit"
    )
  );
  return row;
}

function editWordForm(ko, en, note) {
  const form = h(
    "form",
    {
      class: "inline-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
          await addCustomWord({ ko: fd.get("ko"), en: fd.get("en"), note: fd.get("note"), replaces: ko });
          form.replaceWith(h("div", { class: "source-label glossary" }, "✓ Saved — permanent in your glossary"));
        } catch (error) {
          form.append(h("div", { class: "note" }, error.message));
        }
      },
    },
    h("input", { name: "ko", value: ko, placeholder: "한국어", required: true }),
    h("input", { name: "en", value: en, placeholder: "English", required: true }),
    h("input", { name: "note", value: note, placeholder: "note (optional)" }),
    h("button", { class: "pill-btn small", type: "submit" }, "Save")
  );
  return form;
}

function saveWordControls(data, open = false) {
  const isKo = data.language === "ko";
  const form = editWordForm(isKo ? data.mt?.corrected ?? data.query : data.mt?.text ?? "", isKo ? data.mt?.text ?? "" : data.query, "");
  if (open) return form;
  const btn = h("button", { class: "ghost-btn small", type: "button", onclick: () => btn.replaceWith(form) }, "Save as my word");
  return h("div", { class: "row-actions" }, btn);
}

function makeDeck(data, button) {
  const s = activeSession();
  const title = `${s?.title ?? "Scan"} — ${new Date().toLocaleDateString()}`;
  const id = `deck-${Date.now()}`;
  setItem("decks", id, { id, title, words: data.found.map((f) => f.entry.ko) });
  button.textContent = `✓ Deck saved: “${title}” (Flashcards tab)`;
  button.disabled = true;
  document.dispatchEvent(new CustomEvent("decks-changed"));
}

// ---------------------------------------------------------------------------
// Live suggestions while typing (instant, offline, deterministic)
// ---------------------------------------------------------------------------
function updateSuggest() {
  const text = chatInput.value.trim();
  liveSuggest.innerHTML = "";
  if (!text || text.length > 30 || text.includes("\n")) return hideSuggest();
  const parsed = parseReferences(text);
  if (parsed?.refs.length) {
    liveSuggest.append(
      h("span", { class: "chip", onclick: () => submit(text) }, "📖 ", parsed.refs.map((r) => `${formatReference(r)} · ${formatReference(r, "ko")}`).join("; "), h("span", { class: "en" }, "  ↵"))
    );
    liveSuggest.hidden = false;
    return;
  }
  const results = getGlossary().autocomplete(text, 7);
  if (!results.length) return hideSuggest();
  results.forEach((e) =>
    liveSuggest.append(
      h("button", { class: "chip", type: "button", onclick: () => submit(e.ko) }, h("b", {}, e.ko), h("span", { class: "en" }, trim(e.en, 40)))
    )
  );
  liveSuggest.hidden = false;
}
function hideSuggest() {
  liveSuggest.hidden = true;
  liveSuggest.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Transcript / sessions
// ---------------------------------------------------------------------------
function pushMessage(msg) {
  appendBubble(msg.role, msg.text);
  persist(msg);
  scrollToBottom();
}

function persist(msg) {
  const s = activeSession();
  const stored = { ...msg, timestamp: Date.now() };
  if (s) {
    s.transcript.push(stored);
    saveSession(s);
  }
  return stored;
}

function findMsgForBubble(bubble) {
  const s = activeSession();
  const idx = [...chatLog.querySelectorAll(".chat-bubble")].indexOf(bubble);
  return s?.transcript[idx] ?? null;
}

function appendBubble(role, content) {
  chatLog.querySelector(".chat-empty")?.remove();
  const li = h("li", { class: `chat-bubble ${role}` }, role === "user" ? null : h("div", { class: "chat-meta" }, role === "system" ? "System" : "Helper"));
  const body = h("div", { class: "chat-text" });
  if (content instanceof Node) body.append(content);
  else body.textContent = content;
  li.append(body);
  chatLog.append(li);
  scrollToBottom();
  return li;
}

function fillBubble(bubble, data) {
  const body = bubble.querySelector(".chat-text");
  body.innerHTML = "";
  body.append(renderResult(data));
  scrollToBottom();
}

function renderChatLog() {
  chatLog.innerHTML = "";
  const s = activeSession();
  if (!s || s.transcript.length === 0) {
    chatLog.append(
      h(
        "li",
        { class: "chat-empty" },
        h("p", {}, "Type a Korean or English word — matches from your lists appear instantly as you type."),
        h("p", {}, "Scripture: ", h("kbd", {}, "롬 8:28"), " ", h("kbd", {}, "요 3장 16-18절"), " ", h("kbd", {}, "Eph 6:10-18; Jas 4:7")),
        h("p", {}, "Before the service, paste the sermon notes or bulletin to see every glossary word in it and turn them into flashcards.")
      )
    );
    return;
  }
  for (const msg of s.transcript) {
    if (msg.data) appendBubble(msg.role, renderResult(msg.data));
    else appendBubble(msg.role, msg.text);
  }
  scrollToBottom(true);
}

function renderSessionInfo() {
  const s = activeSession();
  $("sessionTitle").textContent = s ? s.title : "No session selected";
  const scr = $("sessionScripture");
  scr.hidden = !s?.scripture;
  scr.textContent = s?.scripture ? `📖 ${s.scripture}` : "";
  scr.title = "Show this passage";
  $("sessionSpeaker").textContent = s?.speaker ? `· ${s.speaker}` : "";
}

function renderSessionList() {
  const list = $("sessionList");
  list.innerHTML = "";
  if (!sessions.length) {
    list.append(h("p", { class: "muted small" }, "No sessions yet. Create one below."));
    return;
  }
  [...sessions]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .forEach((s) => {
      list.append(
        h(
          "div",
          {
            class: `session-item${s.id === activeSessionId ? " active" : ""}`,
            onclick: () => {
              setActive(s.id);
              sessionDialog.close();
            },
          },
          h(
            "div",
            { class: "session-meta" },
            h("span", {}, s.title),
            h("span", { class: "muted small" }, [s.scripture || "No passage", s.speaker, s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""].filter(Boolean).join(" · "))
          ),
          h(
            "div",
            { class: "session-item-actions" },
            h(
              "button",
              {
                class: "edit-btn",
                type: "button",
                title: "Rename, or change the passage or speaker",
                onclick: (e) => {
                  e.stopPropagation();
                  startEditing(s);
                },
              },
              "Edit"
            ),
            h(
              "button",
              {
                class: "del-btn",
                type: "button",
                title: "Delete session",
                onclick: (e) => {
                  e.stopPropagation();
                  if (!confirm(`Delete “${s.title}” and its history?`)) return;
                  sessions = sessions.filter((x) => x.id !== s.id);
                  removeItem("sessions", s.id);
                  if (editingId === s.id) resetSessionForm();
                  if (activeSessionId === s.id) setActive(sessions[sessions.length - 1]?.id ?? null);
                  else renderAll();
                },
              },
              "Delete"
            )
          )
        )
      );
    });
}

function renderAll() {
  renderSessionInfo();
  renderChatLog();
  renderSessionList();
}

function setActive(id) {
  activeSessionId = id;
  save("cih.activeSession", activeSessionId);
  renderAll();
}

function createSession({ title, scripture = "", speaker = "" }) {
  const s = {
    id: crypto.randomUUID?.() ?? `session-${Date.now()}`,
    title,
    scripture,
    speaker,
    transcript: [],
    createdAt: Date.now(),
  };
  sessions.push(s);
  saveSession(s);
  setActive(s.id);
  return s;
}

// The form under the session list creates a session, or edits one after "Edit".
let editingId = null;

function startEditing(s) {
  editingId = s.id;
  $("newTitle").value = s.title ?? "";
  $("newScripture").value = s.scripture ?? "";
  $("newSpeaker").value = s.speaker ?? "";
  $("sessionFormTitle").textContent = `Edit “${s.title}”`;
  $("createSessionBtn").textContent = "Save changes";
  $("newTitle").focus();
  $("newTitle").select();
}

function resetSessionForm() {
  editingId = null;
  ["newTitle", "newScripture", "newSpeaker"].forEach((id) => ($(id).value = ""));
  $("sessionFormTitle").textContent = "New session";
  $("createSessionBtn").textContent = "Create & select";
}

function onCreateSession(e) {
  e.preventDefault();
  const title = $("newTitle").value.trim();
  const scripture = $("newScripture").value.trim();
  const speaker = $("newSpeaker").value.trim();
  const editing = editingId && sessions.find((s) => s.id === editingId);
  if (editing) {
    Object.assign(editing, { title: title || editing.title, scripture, speaker });
    saveSession(editing);
    renderAll();
    sessionDialog.close();
    return;
  }
  createSession({ title: title || `Session ${new Date().toLocaleDateString()}`, scripture, speaker });
  sessionDialog.close();
  if (scripture && looksLikeReference(scripture)) submit(scripture);
}

function openSessionDialog() {
  renderSessionList();
  sessionDialog.showModal?.();
}

function exportSession() {
  const s = activeSession();
  if (!s) return;
  const lines = [`# ${s.title}`, ""];
  if (s.scripture) lines.push(`**Scripture:** ${s.scripture}  `);
  if (s.speaker) lines.push(`**Speaker:** ${s.speaker}  `);
  lines.push(`**Date:** ${new Date(s.createdAt ?? Date.now()).toLocaleString()}`, "");
  for (const m of s.transcript) {
    lines.push(m.role === "user" ? `**▸ ${m.text}**` : m.text, "");
  }
  download(`${s.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.md`, lines.join("\n"), "text/markdown");
}

// ---------------------------------------------------------------------------
function plainLookup(data) {
  const rows = [...data.exact, ...data.found.map((f) => f.entry)].map((e) => `${e.ko} — ${e.senses.map((s) => s.en).join(" · ")}`);
  if (data.mt?.text) rows.push(`(AI) ${data.mt.corrected ? `[did you mean ${data.mt.corrected}?] ` : ""}${data.mt.text}`);
  if (!rows.length) rows.push("Not in word lists." + (data.suggestions.length ? ` Similar: ${data.suggestions.map((s) => s.ko).join(", ")}` : ""));
  return rows.join("\n");
}

function plainScripture(payload) {
  return payload.passages
    .map((p) => [`${p.reference} (${p.referenceKo})`, ...p.verses.map((v) => `${v.verse} ${v.en}\n   ${v.ko}`)].join("\n"))
    .join("\n\n");
}

function trim(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function autoResize() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 200)}px`;
}

function scrollToBottom(instant = false) {
  requestAnimationFrame(() => chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: instant ? "auto" : "smooth" }));
}

