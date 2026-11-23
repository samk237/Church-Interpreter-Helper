import { aiReviewCount, loadCustomWords, onGlossaryChange, saveSettings, settings } from "./state.js";
import { initInterpret } from "./interpret.js";
import { initStudy, refreshStudy, setStudyActive } from "./study.js";
import { initGlossaryView, renderGlossary } from "./glossary-view.js";

const $ = (id) => document.getElementById(id);

function showView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  setStudyActive(name === "study");
  try {
    localStorage.setItem("cih.view", name);
  } catch {
    /* ignore */
  }
  if (name === "interpret") $("chatInput").focus();
}

async function initSettings() {
  $("settingsBtn").addEventListener("click", () => ($("settingsPanel").hidden = !$("settingsPanel").hidden));

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

  try {
    const health = await fetch("/api/health").then((r) => r.json());
    $("healthLine").textContent =
      `English: ${health.esv ? "ESV (api.esv.org)" : "ESV not set up — add ESV_API_KEY to .env.local (offline WEB used meanwhile)"}` +
      ` · Korean: 개역한글 (offline)` +
      ` · Machine translation (fallback): ${health.ollama.reachable ? `Ollama ${health.ollama.model}` : "off — start the Ollama app"}`;
  } catch {
    $("healthLine").textContent = "Server not reachable — start it with `npm start`.";
  }
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));

function updateReviewBadge() {
  const n = aiReviewCount();
  const tab = document.querySelector('.tab[data-view="glossary"]');
  tab.textContent = "Glossary";
  if (n) tab.append(Object.assign(document.createElement("span"), { className: "tab-badge", textContent: n, title: `${n} AI word(s) to review` }));
}

onGlossaryChange(() => {
  renderGlossary();
  refreshStudy();
  updateReviewBadge();
});

initSettings();
initInterpret();
initStudy();
initGlossaryView();
loadCustomWords();

let initialView = "interpret";
try {
  initialView = localStorage.getItem("cih.view") || "interpret";
} catch {
  /* ignore */
}
showView(["interpret", "study", "glossary"].includes(initialView) ? initialView : "interpret");
