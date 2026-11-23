import { aiReviewCount, load, loadCustomWords, onGlossaryChange, save, saveSettings, settings } from "./state.js";
import { initInterpret } from "./interpret.js";
import { initStudy, refreshStudy, setStudyActive } from "./study.js";
import { initGlossaryView, renderGlossary } from "./glossary-view.js";
import { h } from "./dom.js";
import { onSyncStatus, startSync, syncStatus } from "./sync.js";

const $ = (id) => document.getElementById(id);
const VIEWS = ["interpret", "study", "glossary"];

// ---------- tabs ----------
function showView(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.view === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  setStudyActive(name === "study");
  save("cih.view", name);
  // Don't pop the phone keyboard open just by switching tabs.
  if (name === "interpret" && !matchMedia("(pointer: coarse)").matches) $("chatInput").focus();
}

// ---------- theme: system (default) / light / dark ----------
const THEME_KEY = "cih.theme";
const themeLabel = { system: "◐", light: "☀", dark: "☾" };

function currentTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(choice) {
  if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
  else delete document.documentElement.dataset.theme;
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* ignore */
  }
  $("themeBtn").textContent = themeLabel[choice];
  $("themeBtn").title = `Theme: ${choice} (tap to change)`;
  document.querySelectorAll("[data-theme-choice]").forEach((b) => {
    const on = b.dataset.themeChoice === choice;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
  });
}

function initTheme() {
  applyTheme(currentTheme());
  $("themeBtn").addEventListener("click", () => {
    const order = ["system", "light", "dark"];
    applyTheme(order[(order.indexOf(currentTheme()) + 1) % order.length]);
  });
  document.querySelectorAll("[data-theme-choice]").forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.themeChoice)));
}

// ---------- settings ----------
async function initSettings() {
  const panel = $("settingsPanel");
  $("settingsBtn").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    $("settingsBtn").setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) refreshPhonePanel();
  });

  const verseLang = $("verseLangSelect");
  verseLang.value = settings.verseLang;
  verseLang.addEventListener("change", () => {
    settings.verseLang = verseLang.value;
    saveSettings();
    document.querySelectorAll(".verses").forEach((el) => (el.className = `verses lang-${settings.verseLang}`));
  });

  const autoMt = $("autoMtToggle");
  autoMt.checked = settings.autoMt;
  autoMt.addEventListener("change", () => {
    settings.autoMt = autoMt.checked;
    saveSettings();
  });

  // Changed on another device.
  document.addEventListener("settings-changed", () => {
    verseLang.value = settings.verseLang;
    autoMt.checked = settings.autoMt;
    document.querySelectorAll(".verses").forEach((el) => (el.className = `verses lang-${settings.verseLang}`));
  });

  try {
    const health = await fetch("/api/health").then((r) => r.json());
    dataHome = health.mode === "web" ? "web" : "mac";
    renderSyncLine();
    $("healthLine").textContent =
      `English: ${health.esv ? "ESV" : "ESV not set up — add ESV_API_KEY to .env.local (offline WEB meanwhile)"}` +
      ` · Korean: 개역한글 (offline)` +
      ` · AI for new words: ${
        health.ai?.available
          ? health.ai.label
          : health.mode === "web"
            ? "not set up (run npm run web:setup and add a Gemini key)"
            : "not set up (add GEMINI_API_KEY to .env.local, or open the Ollama app)"
      }`;
  } catch {
    $("healthLine").textContent = "Can't reach the helper server right now.";
  }
}

// ---------- where your data lives ----------
let dataHome = null;
function renderSyncLine() {
  const s = syncStatus();
  const when = s.at ? new Date(s.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const where =
    dataHome === "web"
      ? "Your words, AI words to review, flashcards, decks and sessions are saved on your website and shared by every device you sign in on."
      : dataHome === "mac"
        ? "Your words, AI words to review, flashcards, decks and sessions are saved on this Mac (data/my-data.json). Run npm run sync to merge them with the website."
        : "";
  const state =
    s.state === "synced"
      ? `✓ Up to date${when ? ` (${when})` : ""}`
      : s.state === "offline"
        ? `Offline — ${s.pending ? `${s.pending} change(s) will be saved` : "changes will be saved"} when the connection is back.`
        : "";
  $("syncLine").textContent = [where, state].filter(Boolean).join(" ");
}
onSyncStatus(renderSyncLine);

/** "Use on your phone" section — only the Mac itself can see the code/QR. */
async function refreshPhonePanel() {
  const panel = $("phonePanel");
  try {
    const r = await fetch("/api/phone");
    if (!r.ok) {
      panel.hidden = true; // on the phone already, or on the website (no phone pairing needed)
      return;
    }
    const info = await r.json();
    panel.innerHTML = "";
    panel.hidden = false;
    if (!info.enabled) {
      panel.append(
        h(
          "div",
          { class: "phone-info" },
          h("strong", {}, "📱 Use on your phone"),
          h("span", { class: "muted small" }, "Quit this and start it with ", h("code", {}, "npm run phone"), " instead of ", h("code", {}, "npm start"), ". Your phone must be on the same Wi-Fi as this Mac.")
        )
      );
      return;
    }
    const qr = h("div", { class: "qr", "aria-label": "QR code to open on phone" });
    qr.innerHTML = info.qrSvg; // generated by the server's QR library (trusted)
    panel.append(
      qr,
      h(
        "div",
        { class: "phone-info" },
        h("strong", {}, "📱 Scan with your phone's camera"),
        h("span", { class: "muted small" }, "Same Wi-Fi as this Mac. Then use Share → Add to Home Screen to open it like an app."),
        h("span", { class: "small" }, "Or type the address and code:"),
        ...info.urls.map((u) => h("code", {}, u.replace(/\?key=.*/, ""))),
        h("span", { class: "phone-code" }, info.code)
      )
    );
  } catch {
    panel.hidden = true;
  }
}

// ---------- AI review badge on the Glossary tab ----------
function updateReviewBadge() {
  const n = aiReviewCount();
  const tab = document.querySelector('.tab[data-view="glossary"]');
  tab.textContent = "Glossary";
  if (n) tab.append(h("span", { class: "tab-badge", title: `${n} AI word(s) to review` }, n));
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

onGlossaryChange(() => {
  renderGlossary();
  refreshStudy();
  updateReviewBadge();
});

initTheme();
initSettings();
initInterpret();
initStudy();
initGlossaryView();
loadCustomWords();
startSync(loadCustomWords); // also refreshes words when the app comes back to the front

const initialView = load("cih.view", "interpret");
showView(VIEWS.includes(initialView) ? initialView : "interpret");
