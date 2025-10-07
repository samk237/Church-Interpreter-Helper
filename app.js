const STORAGE_KEY = "cih.sessions.v1";
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const manageSessionsBtn = document.getElementById("manageSessionsBtn");
const sessionDialog = document.getElementById("sessionDialog");
const sessionList = document.getElementById("sessionList");
const createSessionBtn = document.getElementById("createSessionBtn");
const newTitleInput = document.getElementById("newTitle");
const newScriptureInput = document.getElementById("newScripture");
const newSpeakerInput = document.getElementById("newSpeaker");
const sessionTitle = document.getElementById("sessionTitle");
const sessionScripture = document.getElementById("sessionScripture");
const sessionSpeaker = document.getElementById("sessionSpeaker");

const SCRIPTURE_API_BASE = "https://bible-api.com/";
const SCRIPTURE_API_TRANSLATION = "web";
const TRANSLATION_API_ENDPOINT = "/api/translate";

const BOOK_ALIASES = {
  acts: { canonical: "Acts", language: "en" },
  사도행전: { canonical: "Acts", language: "ko" },
  행: { canonical: "Acts", language: "ko" },
  john: { canonical: "John", language: "en" },
  요한복음: { canonical: "John", language: "ko" },
  요: { canonical: "John", language: "ko" },
};

const SAMPLE_SCRIPTURE_DB = {
  Acts: {
    chapters: {
      1: {
        8: {
          en: "But you will receive power when the Holy Spirit has come upon you, and you will be my witnesses in Jerusalem and in all Judea and Samaria, and to the end of the earth. (ESV)",
          ko: "오직 성령이 너희에게 임하시면 너희가 권능을 받고 예루살렘과 온 유대와 사마리아와 땅 끝까지 이르러 내 증인이 되리라 하시니라. (KRV)",
        },
      },
    },
  },
  John: {
    chapters: {
      3: {
        16: {
          en: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life. (ESV)",
          ko: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라. (KRV)",
        },
        17: {
          en: "For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him. (ESV)",
          ko: "하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요 그로 말미암아 세상이 구원을 받게 하려 하심이라. (KRV)",
        },
      },
    },
  },
};

const BASE_DICTIONARY = [
  { ko: "안녕하세요", en: "hello" },
  { ko: "감사합니다", en: "thank you" },
  { ko: "하나님", en: "God" },
  { ko: "예수님", en: "Jesus" },
  { ko: "은혜", en: "grace" },
  { ko: "평강", en: "peace" },
  { ko: "기도", en: "prayer" },
  { ko: "찬양", en: "praise" },
  { ko: "기도합시다", en: "let us pray" },
  { ko: "믿음", en: "faith" },
  { ko: "소망", en: "hope" },
  { ko: "사랑", en: "love" },
  { ko: "예배", en: "worship service" },
  { ko: "회개", en: "repentance" },
  { ko: "성령", en: "Holy Spirit" },
  { ko: "축도", en: "benediction" },
  { ko: "설교", en: "sermon" },
  { ko: "말씀", en: "the Word" },
  { ko: "성도", en: "saint" },
  { ko: "성경", en: "Bible" },
  { ko: "찬송가", en: "hymn" },
  { ko: "사랑의 수고", en: "labor of love" },
  { ko: "봉사", en: "service" },
];

const KO_TO_EN = new Map(BASE_DICTIONARY.map((entry) => [entry.ko, entry.en]));
const EN_TO_KO = new Map(BASE_DICTIONARY.map((entry) => [entry.en.toLowerCase(), entry.ko]));

let sessions = loadSessions();
let activeSessionId = sessions[0]?.id ?? null;

const AUTO_SCROLL_THRESHOLD = 160;

init();

function init() {
  if (!activeSessionId && sessions.length > 0) {
    activeSessionId = sessions[0].id;
  }

  renderSessionInfo();
  renderChatLog();
  renderSessionList();
  bindEvents();

  if (!activeSessionId) {
    openSessionDialog();
  }
}

function bindEvents() {
  chatForm.addEventListener("submit", onSubmitMessage);
  manageSessionsBtn.addEventListener("click", openSessionDialog);
  sessionList.addEventListener("click", onSessionListClick);
  createSessionBtn.addEventListener("click", onCreateSession);
  chatInput.addEventListener("input", autoResizeInput);
  chatInput.addEventListener("keydown", onChatInputKeyDown);
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((session) => ({
      ...session,
      transcript: session.transcript ?? [],
      glossary: session.glossary ?? {},
    }));
  } catch (error) {
    console.warn("Failed to load sessions:", error);
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

async function onSubmitMessage(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  if (!activeSessionId) {
    appendMessage("system", "Create or select a session before sending messages.");
    chatInput.value = "";
    scrollChatToBottom({ behavior: "smooth" });
    return;
  }

  chatInput.value = "";
  autoResizeInput();

  const scriptRequest = parseScriptureQuery(text);
  const placeholderText = scriptRequest ? "Looking up the passage…" : "Translating…";

  appendMessage("user", text);
  scrollChatToBottom({ behavior: "smooth", force: true });

  const placeholderBubble = appendMessage("assistant", placeholderText, { persist: false });
  scrollChatToBottom({ behavior: "smooth" });

  try {
    const response = await processMessage(text, { scriptureRequest: scriptRequest });
    updateMessageBubble(placeholderBubble, response);
    persistMessage("assistant", response);
    scrollChatToBottom({ behavior: "smooth" });
  } catch (error) {
    console.warn("Failed to process message:", error);
    const failure = `Sorry, I could not process that request. ${error.message ?? ""}`.trim();
    updateMessageBubble(placeholderBubble, failure);
    persistMessage("assistant", failure);
    scrollChatToBottom({ behavior: "smooth" });
  }
}

async function processMessage(text, { scriptureRequest } = {}) {
  const session = getActiveSession();
  if (!session) return "No active session.";

  const request = scriptureRequest ?? parseScriptureQuery(text);
  if (request) {
    const response = await handleScriptureRequest(request);
    return response;
  }

  const translation = await translateText(text, session);
  return translation;
}

function parseScriptureQuery(raw) {
  const trimmed = raw.trim();
  const pattern = /^([\p{L}\s]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/u;
  const match = trimmed.match(pattern);
  if (!match) return null;

  const alias = match[1].trim().toLowerCase();
  const chapter = Number.parseInt(match[2], 10);
  const verseStart = match[3] ? Number.parseInt(match[3], 10) : null;
  const verseEnd = match[4] ? Number.parseInt(match[4], 10) : null;

  const bookInfo = BOOK_ALIASES[alias];
  if (!bookInfo) return null;

  return {
    canonical: bookInfo.canonical,
    language: bookInfo.language,
    chapter,
    verseStart,
    verseEnd,
  };
}

async function handleScriptureRequest(request) {
  if (request.language === "en") {
    try {
      const apiResult = await fetchScriptureViaApi(request);
      if (apiResult) return apiResult;
    } catch (error) {
      console.warn("Scripture API lookup failed:", error);
    }
    return handleScriptureRequestOffline(request);
  }

  // Korean queries currently fall back to the bundled dataset.
  const offline = handleScriptureRequestOffline(request);
  if (offline && /^\d/.test(offline)) {
    return offline;
  }

  try {
    const englishReference = { ...request, language: "en" };
    const englishResult = await fetchScriptureViaApi(englishReference);
    return englishResult;
  } catch (error) {
    console.warn("Korean fallback via API failed:", error);
  }

  return offline;
}

function handleScriptureRequestOffline(request) {
  const dbEntry = SAMPLE_SCRIPTURE_DB[request.canonical];
  if (!dbEntry) {
    return `No scripture data found for ${request.canonical}.`;
  }

  const chapterData = dbEntry.chapters[request.chapter];
  if (!chapterData) {
    return `${request.canonical} ${request.chapter} is not available in the local sample data yet.`;
  }

  const targetLanguage = request.language === "ko" ? "ko" : "en";

  if (!request.verseStart) {
    return formatEntireChapter(request, chapterData, targetLanguage);
  }

  const start = request.verseStart;
  const end = request.verseEnd ?? request.verseStart;
  const verses = [];

  for (let verse = start; verse <= end; verse += 1) {
    const verseData = chapterData[verse];
    if (!verseData) continue;
    const text = verseData[targetLanguage] ?? verseData.en;
    verses.push(`${verse}. ${text}`);
  }

  if (verses.length === 0) {
    return `No verses matched ${request.canonical} ${request.chapter}:${request.verseStart}${request.verseEnd ? "-" + request.verseEnd : ""} in the local sample.`;
  }

  return verses.join("\n");
}

function formatEntireChapter(request, chapterData, targetLanguage) {
  const verses = Object.keys(chapterData)
    .map((key) => Number.parseInt(key, 10))
    .sort((a, b) => a - b)
    .map((verseNumber) => {
      const verseData = chapterData[verseNumber];
      const text = verseData[targetLanguage] ?? verseData.en;
      return `${verseNumber}. ${text}`;
    });

  if (verses.length === 0) {
    return `${request.canonical} ${request.chapter} is empty in the sample dataset.`;
  }

  return verses.join("\n");
}

async function fetchScriptureViaApi(request) {
  const reference = formatReferenceForApi(request);
  const url = `${SCRIPTURE_API_BASE}${encodeURIComponent(reference)}?translation=${SCRIPTURE_API_TRANSLATION}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Scripture API responded with status ${response.status}.`);
  }
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.verses) || payload.verses.length === 0) {
    throw new Error("Passage not found in API response.");
  }

  return formatVersesFromApi(payload.verses);
}

function formatReferenceForApi(request) {
  const chapterSegment = request.chapter ? `${request.canonical} ${request.chapter}` : request.canonical;
  if (!request.verseStart) {
    return chapterSegment;
  }
  if (request.verseEnd && request.verseEnd !== request.verseStart) {
    return `${chapterSegment}:${request.verseStart}-${request.verseEnd}`;
  }
  return `${chapterSegment}:${request.verseStart}`;
}

function formatVersesFromApi(verses) {
  return verses
    .map((verse) => {
      const chapter = verse.chapter ?? "";
      const number = verse.verse ?? "";
      const cleaned = typeof verse.text === "string" ? verse.text.replace(/\s+/g, " ").trim() : "";
      const label = chapter ? `${chapter}:${number}` : `${number}`;
      return `${label}. ${cleaned}`;
    })
    .join("\n");
}

async function translateText(input, session) {
  const trimmed = input.trim();
  if (trimmed.length === 0) return "";
  const isKorean = containsHangul(trimmed);

  const local = translateLocally(trimmed, session, isKorean);
  if (local.status === "direct") {
    return local.text;
  }

  let remoteError = null;

  if (TRANSLATION_API_ENDPOINT) {
    try {
      const remote = await translateViaApi(trimmed, isKorean ? "ko" : "en");
      storeGlossaryEntry(session, trimmed, remote, isKorean ? "ko" : "en");
      return remote;
    } catch (error) {
      console.warn("Remote translation failed:", error);
      remoteError = error;
    }
  }

  if (local.status === "partial") {
    return local.text;
  }

  if (remoteError) {
    const message = remoteError.message ? ` ${remoteError.message}` : "";
    return `Translation service is unavailable.${message}`;
  }

  return local.text || "No translation available.";
}

function translateLocally(trimmed, session, isKorean) {
  const phraseHit = lookupPhrase(trimmed, isKorean ? "ko" : "en", session);
  if (phraseHit) {
    storeGlossaryEntry(session, trimmed, phraseHit.translated, isKorean ? "ko" : "en");
    return { status: "direct", text: phraseHit.translated };
  }

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) {
    return { status: "direct", text: "" };
  }

  const translatedTokens = [];
  const missingTokens = [];

  tokens.forEach((token) => {
    const lookup = lookupToken(token, isKorean, session);
    if (lookup.found) {
      translatedTokens.push(lookup.value);
    } else {
      translatedTokens.push(token.original);
      if (token.strip) {
        missingTokens.push(token.strip);
      }
    }
  });

  if (missingTokens.length === tokens.length) {
    const first = missingTokens[0];
    const suggestions = first ? suggestSimilar(first, isKorean ? "ko" : "en") : [];
    if (suggestions.length > 0) {
      const suggestionLines = suggestions.map(
        (entry) => `${entry.source} → ${entry.target}`
      );
      return {
        status: "suggestions",
        text: `No direct match. Similar terms:\n${suggestionLines.join("\n")}`,
      };
    }
    return {
      status: "none",
      text: "No translation available in the local dictionary.",
    };
  }

  const result = rebuildText(tokens, translatedTokens);

  tokens.forEach((token, index) => {
    if (translatedTokens[index] && translatedTokens[index] !== token.original) {
      storeGlossaryEntry(session, token.strip, translatedTokens[index], isKorean ? "ko" : "en");
    }
  });

  return {
    status: missingTokens.length === 0 ? "direct" : "partial",
    text: result,
  };
}

async function translateViaApi(text, sourceLang) {
  const response = await fetch(TRANSLATION_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      sourceLang,
    }),
  });
  if (!response.ok) {
    throw new Error(`Translation API responded with status ${response.status}.`);
  }
  const payload = await response.json();
  const candidate =
    payload?.translatedText ??
    payload?.translated_text ??
    payload?.translation ??
    "";
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  throw new Error("Translation API returned an unexpected payload.");
}

function lookupPhrase(phrase, sourceLang, session) {
  const normalized = normalizeToken(phrase, sourceLang === "ko");
  const fromGlossary = session.glossary[normalized];
  if (fromGlossary) {
    return { translated: fromGlossary };
  }

  if (sourceLang === "ko") {
    const hit = KO_TO_EN.get(phrase);
    if (hit) return { translated: hit };
  } else {
    const hit = EN_TO_KO.get(phrase.toLowerCase());
    if (hit) return { translated: hit };
  }

  return null;
}

function lookupToken(token, isKoreanSource, session) {
  const normalized = normalizeToken(token.strip, isKoreanSource);
  if (!normalized) {
    return { found: false, value: token.original };
  }

  const glossaryHit = session.glossary[normalized];
  if (glossaryHit) {
    return { found: true, value: applyCase(glossaryHit, token.original) };
  }

  if (isKoreanSource) {
    const dictionaryHit = KO_TO_EN.get(token.strip);
    if (dictionaryHit) {
      return { found: true, value: applyCase(dictionaryHit, token.original) };
    }
  } else {
    const dictionaryHit = EN_TO_KO.get(token.strip.toLowerCase());
    if (dictionaryHit) {
      return { found: true, value: dictionaryHit };
    }
  }

  return { found: false, value: token.original };
}

function tokenize(text) {
  const regex = /[\p{L}’']+|\d+|[^\s\p{L}\d]+/gu;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const original = match[0];
    const strip = original.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
    matches.push({
      original,
      strip,
    });
  }
  return matches;
}

function rebuildText(tokens, translatedTokens) {
  let cursor = 0;
  return tokens
    .map((token, index) => {
      const translated = translatedTokens[index];
      const nextIndex = cursor + token.original.length;
      cursor = nextIndex;
      return translated ?? token.original;
    })
    .join(" ");
}

function storeGlossaryEntry(session, source, target, sourceLang) {
  const normalized = normalizeToken(source, sourceLang === "ko");
  if (!normalized) return;
  session.glossary[normalized] = target;
  saveSessions();
}

function normalizeToken(token, isKoreanSource) {
  if (!token) return "";
  return isKoreanSource ? token : token.toLowerCase();
}

function containsHangul(text) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

function applyCase(source, reference) {
  if (reference === reference.toUpperCase()) {
    return source.toUpperCase();
  }
  if (reference[0] === reference[0]?.toUpperCase()) {
    return source.charAt(0).toUpperCase() + source.slice(1);
  }
  return source;
}

function suggestSimilar(token, language) {
  const dictionary = language === "ko" ? BASE_DICTIONARY.map((entry) => entry.ko) : BASE_DICTIONARY.map((entry) => entry.en);
  const targetDictionary =
    language === "ko"
      ? BASE_DICTIONARY.map((entry) => ({ source: entry.ko, target: entry.en }))
      : BASE_DICTIONARY.map((entry) => ({ source: entry.en, target: entry.ko }));

  const scored = dictionary.map((entry, idx) => ({
    score: levenshteinDistance(token, entry),
    entry: targetDictionary[idx],
  }));

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .filter((candidate) => candidate.score < Math.max(token.length, 4))
    .map((candidate) => candidate.entry);
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function onSessionListClick(event) {
  const item = event.target.closest("[data-session-id]");
  if (!item) return;
  const sessionId = item.dataset.sessionId;
  setActiveSession(sessionId);
  if (typeof sessionDialog.close === "function") {
    sessionDialog.close();
  }
}

function setActiveSession(sessionId) {
  activeSessionId = sessionId;
  renderSessionInfo();
  renderChatLog();
  renderSessionList();
  saveSessions();
}

function renderSessionInfo() {
  const session = getActiveSession();
  if (!session) {
    sessionTitle.textContent = "No session selected";
    sessionScripture.textContent = "";
    sessionSpeaker.textContent = "";
    return;
  }

  sessionTitle.textContent = session.title;
  sessionScripture.textContent = session.scripture ? `• ${session.scripture}` : "";
  sessionSpeaker.textContent = session.speaker ? `• ${session.speaker}` : "";
}

function renderChatLog() {
  chatLog.innerHTML = "";
  const session = getActiveSession();
  if (!session) return;
  session.transcript.forEach((entry) => {
    appendMessage(entry.role, entry.text, { persist: false });
  });
  scrollChatToBottom({ behavior: "auto", force: true });
}

function appendMessage(role, text, { persist = true } = {}) {
  const template = document.getElementById("chatBubbleTemplate");
  const bubble = template.content.firstElementChild.cloneNode(true);
  bubble.classList.add(role);
  const meta = bubble.querySelector(".chat-meta");
  const body = bubble.querySelector(".chat-text");
  if (meta) meta.textContent = roleLabel(role);
  if (body) body.textContent = text;
  chatLog.appendChild(bubble);
  if (persist) {
    persistMessage(role, text);
  }
  return bubble;
}

function updateMessageBubble(bubble, text) {
  if (!bubble) return;
  const body = bubble.querySelector(".chat-text");
  if (body) {
    body.textContent = text;
  }
}

function persistMessage(role, text) {
  const session = getActiveSession();
  if (!session) return;
  session.transcript.push({ role, text, timestamp: Date.now() });
  saveSessions();
}

function roleLabel(role) {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Helper";
    case "system":
      return "System";
    default:
      return role;
  }
}

function getActiveSession() {
  return sessions.find((session) => session.id === activeSessionId) ?? null;
}

function renderSessionList() {
  sessionList.innerHTML = "";
  if (sessions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No sessions yet. Create one below.";
    sessionList.appendChild(empty);
    return;
  }

  sessions
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .forEach((session) => {
      const item = document.createElement("div");
      item.className = "session-item";
      if (session.id === activeSessionId) {
        item.classList.add("active");
      }
      item.dataset.sessionId = session.id;

      const meta = document.createElement("div");
      meta.className = "session-meta";
      const titleSpan = document.createElement("span");
      titleSpan.textContent = session.title;
      const subtitleSpan = document.createElement("span");
      subtitleSpan.className = "muted";
      const scripture = session.scripture ? session.scripture : "No scripture noted";
      const speaker = session.speaker ? `• ${session.speaker}` : "";
      subtitleSpan.textContent = `${scripture} ${speaker}`.trim();
      meta.appendChild(titleSpan);
      meta.appendChild(subtitleSpan);

      item.appendChild(meta);
      sessionList.appendChild(item);
    });
}

function onCreateSession(event) {
  event.preventDefault();
  const title = newTitleInput.value.trim();
  if (!title) return;

  const scripture = newScriptureInput.value.trim();
  const speaker = newSpeakerInput.value.trim();

  const newSession = {
    id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    title,
    scripture,
    speaker,
    transcript: [],
    glossary: {},
    createdAt: Date.now(),
  };

  sessions.push(newSession);
  setActiveSession(newSession.id);
  newTitleInput.value = "";
  newScriptureInput.value = "";
  newSpeakerInput.value = "";
  renderSessionList();
  if (typeof sessionDialog.close === "function") {
    sessionDialog.close();
  }
}

function openSessionDialog() {
  renderSessionList();
  if (typeof sessionDialog.showModal === "function") {
    sessionDialog.showModal();
  }
}

function scrollChatToBottom({ behavior = "auto", force = false } = {}) {
  if (!chatLog) return;
  const distanceFromBottom = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight;
  if (!force && distanceFromBottom > AUTO_SCROLL_THRESHOLD) {
    return;
  }
  chatLog.scrollTo({
    top: chatLog.scrollHeight,
    behavior,
  });
}

function autoResizeInput() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 200)}px`;
}

function onChatInputKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}
