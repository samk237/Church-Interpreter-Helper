/**
 * Small, dependency-free Hangul helpers used for deterministic matching.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNGSEONG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONGSEONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

export function containsHangul(text) {
  return /[ㄱ-ㆎ가-힣]/.test(String(text ?? ""));
}

export function isHangulSyllable(ch) {
  const code = ch.charCodeAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_END;
}

/** "맹세" -> ["ㅁ","ㅐ","ㅇ","ㅅ","ㅔ"]  (non-Hangul characters pass through). */
export function toJamo(text) {
  const out = [];
  for (const ch of String(text ?? "")) {
    if (isHangulSyllable(ch)) {
      const offset = ch.charCodeAt(0) - HANGUL_BASE;
      const l = Math.floor(offset / 588);
      const v = Math.floor((offset % 588) / 28);
      const t = offset % 28;
      out.push(CHOSEONG[l], JUNGSEONG[v]);
      if (t) out.push(JONGSEONG[t]);
    } else {
      out.push(ch);
    }
  }
  return out;
}

/** Initial consonants only: "하나님" -> "ㅎㄴㄴ" (lets people type 초성 shortcuts). */
export function toChoseong(text) {
  let out = "";
  for (const ch of String(text ?? "")) {
    if (isHangulSyllable(ch)) out += CHOSEONG[Math.floor((ch.charCodeAt(0) - HANGUL_BASE) / 588)];
    else if (!/\s/.test(ch)) out += ch;
  }
  return out;
}

export function isChoseongOnly(text) {
  return /^[ㄱ-ㅎ]{2,}$/.test(String(text ?? "").replace(/\s/g, ""));
}

/** Remove spaces and punctuation so "하늘 나라" and "하늘나라" compare equal. */
export function compactKorean(text) {
  return String(text ?? "")
    .normalize("NFC")
    .replace(/[\s.,!?·~\-_'"“”‘’()[\]{}<>/\\|:;]/g, "")
    .toLowerCase();
}

/**
 * Particles / endings that commonly follow a noun. Longest first so "에서는" wins over "에".
 * Used to decide whether a match on a 1-syllable word is a real word boundary.
 */
export const PARTICLES = [
  "께서는", "에게서", "으로서", "으로써", "이라는", "에서는", "에게는", "이라고", "입니다", "이었다", "이셨다",
  "께서", "에서", "에게", "한테", "으로", "처럼", "까지", "부터", "마다", "이나", "이랑", "하고", "이다", "이며",
  "이고", "이요", "만큼", "보다", "라는", "라고", "에는", "와는", "과는", "은", "는", "이", "가", "을", "를",
  "의", "에", "도", "로", "와", "과", "만", "야", "요", "께", "나",
];

export function stripParticle(word) {
  for (const p of PARTICLES) {
    if (word.length > p.length && word.endsWith(p)) return word.slice(0, -p.length);
  }
  return word;
}

/**
 * Extra lookup forms for a Korean headword so conjugated speech still matches.
 *   시기하다 -> 시기하, 시기해, 시기했, 시기한, 시기할, 시기함, 시기
 *   버티다   -> 버티
 *   거듭나다 -> 거듭나, 거듭났
 */
export function conjugationForms(headword) {
  const word = compactKorean(headword);
  const forms = new Set();
  if (word.length >= 3 && word.endsWith("하다")) {
    const base = word.slice(0, -2);
    ["하", "해", "했", "한", "할", "함", "합", "하시", "하셨", "하여"].forEach((e) => forms.add(base + e));
    if (base.length >= 2) forms.add(base);
  } else if (word.length >= 3 && word.endsWith("한다")) {
    const base = word.slice(0, -2);
    ["하", "해", "했", "한", "할", "합"].forEach((e) => forms.add(base + e));
    if (base.length >= 2) forms.add(base);
  } else if (word.length >= 3 && /[다]$/.test(word)) {
    const stem = word.slice(0, -1);
    if (stem.length >= 2) forms.add(stem);
    // ㄴ다 present forms: 이룬다 -> 이루, 물리친다 -> 물리치
    const last = stem[stem.length - 1];
    const contracted = contractVowel(last);
    if (contracted && stem.length >= 2) {
      // 망설이 + 었 -> 망설였, 이루 + 어 -> 이뤄
      forms.add(stem.slice(0, -1) + contracted.open);
      forms.add(stem.slice(0, -1) + contracted.past);
    }
    if (last && isHangulSyllable(last)) {
      const offset = last.charCodeAt(0) - HANGUL_BASE;
      if (offset % 28 === 4) {
        // final ㄴ -> drop it
        const bare = String.fromCharCode(last.charCodeAt(0) - 4);
        const s2 = stem.slice(0, -1) + bare;
        if (s2.length >= 2) forms.add(s2);
      }
    }
  }
  forms.delete(word);
  return [...forms];
}

// vowel index (JUNGSEONG order) -> contracted vowel index when followed by 어/아
const VOWEL_CONTRACTION = { 20: 6 /* ㅣ->ㅕ */, 8: 9 /* ㅗ->ㅘ */, 13: 14 /* ㅜ->ㅝ */, 18: 4 /* ㅡ->ㅓ */ };

/** For an open syllable (no final consonant) return its 어/아-contracted forms: 이 -> {open: 여, past: 였}. */
function contractVowel(syllable) {
  if (!syllable || !isHangulSyllable(syllable)) return null;
  const offset = syllable.charCodeAt(0) - HANGUL_BASE;
  if (offset % 28 !== 0) return null;
  const l = Math.floor(offset / 588);
  const v = Math.floor((offset % 588) / 28);
  const nv = VOWEL_CONTRACTION[v];
  if (nv === undefined) return null;
  const base = HANGUL_BASE + l * 588 + nv * 28;
  return { open: String.fromCharCode(base), past: String.fromCharCode(base + 20) /* ㅆ */ };
}

/** Levenshtein distance over arrays or strings. */
export function editDistance(a, b) {
  const A = Array.isArray(a) ? a : [...a];
  const B = Array.isArray(b) ? b : [...b];
  if (A.length === 0) return B.length;
  if (B.length === 0) return A.length;
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= B.length; j += 1) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[B.length];
}
