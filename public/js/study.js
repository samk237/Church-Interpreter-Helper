import { fetchScripture, getGlossary, load, save, scriptureLists, wordLists } from "./state.js";
import { h, renderEntry, renderPassages } from "./dom.js";

const PROGRESS_KEY = "cih.progress.v1";
const DECKS_KEY = "cih.decks.v1";
const STUDY_KEY = "cih.study.v1";
const ROUND_SIZE = 25;
const MASTERED_BOX = 3;

const $ = (id) => document.getElementById(id);
const deckSelect = $("deckSelect");
const directionSelect = $("directionSelect");
const stage = $("cardStage");

let progress = load(PROGRESS_KEY, {});
const prefs = { deck: "star", direction: "ko-en", ...load(STUDY_KEY, {}) };
let round = null; // { queue: Card[], total, again: Set, done: number }
let current = null; // { card, dir, flipped }
let active = false;

export function initStudy() {
  directionSelect.value = prefs.direction;
  deckSelect.addEventListener("change", () => {
    prefs.deck = deckSelect.value;
    save(STUDY_KEY, prefs);
    startRound();
  });
  directionSelect.addEventListener("change", () => {
    prefs.direction = directionSelect.value;
    save(STUDY_KEY, prefs);
    startRound();
  });
  $("restartDeckBtn").addEventListener("click", () => startRound());
  document.addEventListener("decks-changed", populateDecks);
  document.addEventListener("keydown", onKey);
  populateDecks();
}

export function setStudyActive(on) {
  active = on;
  if (on && !round) startRound();
}

export function refreshStudy() {
  populateDecks();
}

// ---------------------------------------------------------------------------
function populateDecks() {
  const g = getGlossary();
  const saved = load(DECKS_KEY, []);
  const options = [
    ["star", `★ Starred (${g.entries.filter((e) => e.star).length})`],
    ["review", "Needs review (missed before)"],
    ["all", `All words (${g.size})`],
    ...wordLists.map((l) => [`list:${l.id}`, `${l.title} (${l.entries.length})`]),
    ["list:custom", `My added words (${g.entries.filter((e) => e.custom).length})`],
    ...scriptureLists.map((l) => [`scripture:${l.id}`, `📖 ${l.title} (${l.passages.length})`]),
    ...saved.map((d) => [`deck:${d.id}`, `🗂 ${d.title} (${d.words.length})`]),
  ];
  deckSelect.innerHTML = "";
  options.forEach(([value, label]) => deckSelect.append(h("option", { value }, label)));
  deckSelect.value = options.some(([v]) => v === prefs.deck) ? prefs.deck : "star";
}

function deckCards(deckId) {
  const g = getGlossary();
  const word = (e) => ({ id: `w:${e.id}`, type: "word", entry: e });
  if (deckId === "all") return g.entries.map(word);
  if (deckId === "star") return g.entries.filter((e) => e.star).map(word);
  if (deckId === "review") {
    const words = g.entries.filter((e) => progress[`w:${e.id}`]?.wrong > 0 && (progress[`w:${e.id}`]?.box ?? 0) < MASTERED_BOX).map(word);
    const verses = allScriptureCards().filter((c) => progress[c.id]?.wrong > 0 && (progress[c.id]?.box ?? 0) < MASTERED_BOX);
    return [...words, ...verses];
  }
  if (deckId.startsWith("list:")) {
    const id = deckId.slice(5);
    return g.entries.filter((e) => e.lists.includes(id)).map(word);
  }
  if (deckId.startsWith("scripture:")) {
    const list = scriptureLists.find((l) => l.id === deckId.slice(10));
    return (list?.passages ?? []).map(scriptureCard);
  }
  if (deckId.startsWith("deck:")) {
    const d = load(DECKS_KEY, []).find((x) => `deck:${x.id}` === deckId);
    return (d?.words ?? []).map((ko) => g.get(ko)).filter(Boolean).map(word);
  }
  return [];
}

const scriptureCard = ([ref, note, opts]) => ({ id: `s:${ref}`, type: "scripture", ref, note, star: opts?.star });
const allScriptureCards = () => scriptureLists.flatMap((l) => l.passages.map(scriptureCard));

function startRound(cards) {
  const pool = cards ?? deckCards(deckSelect.value || prefs.deck);
  // lowest box first (unseen = -1), random within a box
  const sorted = pool
    .map((c) => ({ c, box: progress[c.id]?.box ?? -1, r: Math.random() }))
    .sort((a, b) => a.box - b.box || a.r - b.r)
    .map((x) => x.c)
    .slice(0, ROUND_SIZE);
  // shuffle the selection so boxes interleave a little
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  round = { queue: sorted, total: sorted.length, again: new Set(), right: 0, poolSize: pool.length, pool };
  next();
}

function next() {
  if (!round.queue.length) {
    current = null;
    renderSummary();
    return;
  }
  const card = round.queue[0];
  const dir = prefs.direction === "mixed" ? (Math.random() < 0.5 ? "ko-en" : "en-ko") : prefs.direction;
  current = { card, dir, flipped: false };
  renderCard();
}

function flip() {
  if (!current || current.flipped) return;
  current.flipped = true;
  renderCard();
}

function grade(level) {
  if (!current?.flipped) return;
  const { card } = current;
  const p = progress[card.id] ?? { box: 0, seen: 0, right: 0, wrong: 0 };
  p.seen += 1;
  p.last = Date.now();
  round.queue.shift();
  if (level === 1) {
    p.box = 0;
    p.wrong += 1;
    round.again.add(card.id);
    round.queue.splice(Math.min(3, round.queue.length), 0, card); // see it again soon
  } else {
    p.box = Math.min(5, (p.box ?? 0) + (level === 3 ? 2 : 1));
    p.right += 1;
    round.right += 1;
  }
  progress[card.id] = p;
  save(PROGRESS_KEY, progress);
  next();
}

function onKey(e) {
  if (!active || e.target.closest("input, textarea, select")) return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    current?.flipped ? null : flip();
  } else if (["1", "2", "3"].includes(e.key)) {
    grade(Number(e.key));
  }
}

// ---------------------------------------------------------------------------
function renderProgress() {
  const done = round ? round.total - new Set(round.queue.map((c) => c.id)).size : 0;
  const pct = round?.total ? (done / round.total) * 100 : 0;
  $("progressFill").style.width = `${pct}%`;
  const mastered = round ? round.pool.filter((c) => (progress[c.id]?.box ?? 0) >= MASTERED_BOX).length : 0;
  $("progressText").textContent = round
    ? `${done}/${round.total} this round · ${mastered}/${round.poolSize} mastered in deck`
    : "";
}

function renderCard() {
  renderProgress();
  stage.innerHTML = "";
  const { card, dir, flipped } = current;
  const el = h("div", { class: "flashcard", onclick: flip });

  if (card.type === "word") {
    const e = card.entry;
    const enText = e.senses.map((s) => s.en).join(" · ");
    const front = dir === "ko-en" ? e.ko : enText;
    el.append(
      h("div", { class: "card-tag" }, [...e.lists].map((l) => getGlossary().listTitles.get(l) ?? l).join(" · "), e.star ? "  ★" : ""),
      h("div", { class: `front${front.length > 24 ? " long" : ""}` }, front)
    );
    if (flipped) {
      const back = h("div", { class: "back" });
      if (dir === "ko-en") back.append(renderEntry(e));
      else back.append(h("div", { class: "entry-ko" }, e.ko), e.alts.length ? h("div", { class: "entry-alt" }, `also: ${e.alts.join(", ")}`) : null, ...e.senses.map((s) => s.note).filter(Boolean).map((n) => h("div", { class: "note" }, "ⓘ ", n)));
      el.append(back);
    } else {
      el.append(h("div", { class: "hint" }, "tap to reveal"));
    }
  } else {
    const front = dir === "ko-en" ? card.ref : card.note;
    el.append(h("div", { class: "card-tag" }, "Scripture", card.star ? "  ★" : ""), h("div", { class: `front${front.length > 24 ? " long" : ""}` }, front));
    if (flipped) {
      const back = h("div", { class: "back" }, h("div", {}, dir === "ko-en" ? card.note : card.ref));
      const versesBox = h("div", { class: "muted small" }, "Loading passage…");
      back.append(versesBox);
      el.append(back);
      fetchScripture(card.ref)
        .then((payload) => versesBox.replaceWith(renderPassages(payload, { compact: true })))
        .catch(() => (versesBox.textContent = "(passage text unavailable — is the server running?)"));
    } else {
      el.append(h("div", { class: "hint" }, dir === "ko-en" ? "what is this passage about?" : "which passage?"));
    }
  }
  stage.append(el);

  if (flipped) {
    stage.append(
      h(
        "div",
        { class: "grade-row" },
        h("button", { class: "ghost-btn grade-again", onclick: () => grade(1) }, "1 · Again"),
        h("button", { class: "ghost-btn grade-good", onclick: () => grade(2) }, "2 · Good"),
        h("button", { class: "ghost-btn grade-easy", onclick: () => grade(3) }, "3 · Easy")
      )
    );
  }
}

function renderSummary() {
  renderProgress();
  stage.innerHTML = "";
  if (!round.total) {
    stage.append(h("div", { class: "round-summary muted" }, h("p", {}, "This deck is empty."), h("p", {}, "Star words in data/word-lists.js, add your own words, or pick another deck.")));
    return;
  }
  const missed = round.pool.filter((c) => round.again.has(c.id));
  stage.append(
    h(
      "div",
      { class: "round-summary" },
      h("h2", {}, "Round complete"),
      h("p", {}, `${round.total - round.again.size} of ${round.total} right the first time.`),
      h(
        "div",
        { class: "row-actions", style: "justify-content:center" },
        h("button", { class: "pill-btn", onclick: () => startRound() }, "Next round"),
        missed.length ? h("button", { class: "ghost-btn", onclick: () => startRound(missed) }, `Review ${missed.length} missed`) : null
      )
    )
  );
}

