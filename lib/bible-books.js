/**
 * The 66 books of the Protestant canon with English + Korean names and the
 * abbreviations people actually type (English and Korean).
 * Shared by the browser and the server.
 */

// [english name, korean name, chapters, english aliases, korean aliases]
const RAW = [
  ["Genesis", "창세기", 50, ["gen", "ge", "gn"], ["창"]],
  ["Exodus", "출애굽기", 40, ["exod", "exo", "ex"], ["출"]],
  ["Leviticus", "레위기", 27, ["lev", "le", "lv"], ["레"]],
  ["Numbers", "민수기", 36, ["num", "nu", "nm", "nb"], ["민"]],
  ["Deuteronomy", "신명기", 34, ["deut", "deu", "de", "dt"], ["신"]],
  ["Joshua", "여호수아", 24, ["josh", "jos", "jsh"], ["수"]],
  ["Judges", "사사기", 21, ["judg", "jdg", "jg", "jdgs"], ["삿"]],
  ["Ruth", "룻기", 4, ["rth", "ru"], ["룻"]],
  ["1 Samuel", "사무엘상", 31, ["sam", "sa", "sm", "samuel"], ["삼상"]],
  ["2 Samuel", "사무엘하", 24, ["sam", "sa", "sm", "samuel"], ["삼하"]],
  ["1 Kings", "열왕기상", 22, ["kgs", "ki", "kings", "kin"], ["왕상"]],
  ["2 Kings", "열왕기하", 25, ["kgs", "ki", "kings", "kin"], ["왕하"]],
  ["1 Chronicles", "역대상", 29, ["chr", "chron", "ch", "chronicles"], ["대상", "역대기상"]],
  ["2 Chronicles", "역대하", 36, ["chr", "chron", "ch", "chronicles"], ["대하", "역대기하"]],
  ["Ezra", "에스라", 10, ["ezr"], ["스"]],
  ["Nehemiah", "느헤미야", 13, ["neh", "ne"], ["느"]],
  ["Esther", "에스더", 10, ["esth", "est", "es"], ["에"]],
  ["Job", "욥기", 42, ["jb"], ["욥"]],
  ["Psalms", "시편", 150, ["ps", "psa", "psalm", "pss", "psm", "pslm"], ["시"]],
  ["Proverbs", "잠언", 31, ["prov", "pro", "prv", "pr"], ["잠"]],
  ["Ecclesiastes", "전도서", 12, ["eccl", "eccles", "ecc", "ec", "qoh"], ["전"]],
  ["Song of Songs", "아가", 8, ["song", "sos", "songofsolomon", "ss", "canticles", "sng"], ["아", "아가서"]],
  ["Isaiah", "이사야", 66, ["isa", "is"], ["사"]],
  // "예" isn't a standard abbreviation, but it shows up in notes ("예 33:3" = 렘 33:3).
  ["Jeremiah", "예레미야", 52, ["jer", "je", "jr"], ["렘", "예"]],
  ["Lamentations", "예레미야애가", 5, ["lam", "la"], ["애", "애가"]],
  ["Ezekiel", "에스겔", 48, ["ezek", "eze", "ezk"], ["겔"]],
  ["Daniel", "다니엘", 12, ["dan", "da", "dn"], ["단"]],
  ["Hosea", "호세아", 14, ["hos", "ho"], ["호"]],
  ["Joel", "요엘", 3, ["jl"], ["욜"]],
  ["Amos", "아모스", 9, ["am"], ["암"]],
  ["Obadiah", "오바댜", 1, ["obad", "ob"], ["옵"]],
  ["Jonah", "요나", 4, ["jon", "jnh"], ["욘"]],
  ["Micah", "미가", 7, ["mic", "mc"], ["미"]],
  ["Nahum", "나훔", 3, ["nah", "na"], ["나"]],
  ["Habakkuk", "하박국", 3, ["hab", "hb"], ["합"]],
  ["Zephaniah", "스바냐", 3, ["zeph", "zep", "zp"], ["습"]],
  ["Haggai", "학개", 2, ["hag", "hg"], ["학"]],
  ["Zechariah", "스가랴", 14, ["zech", "zec", "zc"], ["슥"]],
  ["Malachi", "말라기", 4, ["mal", "ml"], ["말"]],
  ["Matthew", "마태복음", 28, ["matt", "mat", "mt"], ["마", "마태"]],
  ["Mark", "마가복음", 16, ["mrk", "mar", "mk"], ["막", "마가"]],
  ["Luke", "누가복음", 24, ["luk", "lk"], ["눅", "누가"]],
  ["John", "요한복음", 21, ["jn", "jhn", "joh"], ["요", "요한"]],
  ["Acts", "사도행전", 28, ["act", "ac"], ["행", "행전"]],
  ["Romans", "로마서", 16, ["rom", "ro", "rm"], ["롬", "로마"]],
  ["1 Corinthians", "고린도전서", 16, ["cor", "co", "corinthians"], ["고전"]],
  ["2 Corinthians", "고린도후서", 13, ["cor", "co", "corinthians"], ["고후"]],
  ["Galatians", "갈라디아서", 6, ["gal", "ga"], ["갈"]],
  ["Ephesians", "에베소서", 6, ["eph", "ephes"], ["엡"]],
  ["Philippians", "빌립보서", 4, ["phil", "php", "pp"], ["빌"]],
  ["Colossians", "골로새서", 4, ["col"], ["골"]],
  ["1 Thessalonians", "데살로니가전서", 5, ["thess", "thes", "th", "thessalonians"], ["살전"]],
  ["2 Thessalonians", "데살로니가후서", 3, ["thess", "thes", "th", "thessalonians"], ["살후"]],
  ["1 Timothy", "디모데전서", 6, ["tim", "ti", "tm", "timothy"], ["딤전"]],
  ["2 Timothy", "디모데후서", 4, ["tim", "ti", "tm", "timothy"], ["딤후"]],
  ["Titus", "디도서", 3, ["tit"], ["딛"]],
  ["Philemon", "빌레몬서", 1, ["philem", "phile", "phm", "pm"], ["몬"]],
  ["Hebrews", "히브리서", 13, ["heb", "he"], ["히", "히브리"]],
  ["James", "야고보서", 5, ["jas", "jm", "jam"], ["약", "야고보"]],
  ["1 Peter", "베드로전서", 5, ["pet", "pe", "pt", "peter"], ["벧전"]],
  ["2 Peter", "베드로후서", 3, ["pet", "pe", "pt", "peter"], ["벧후"]],
  ["1 John", "요한일서", 5, ["jn", "jhn", "jo", "john", "joh"], ["요일"]],
  ["2 John", "요한이서", 1, ["jn", "jhn", "jo", "john", "joh"], ["요이"]],
  ["3 John", "요한삼서", 1, ["jn", "jhn", "jo", "john", "joh"], ["요삼"]],
  ["Jude", "유다서", 1, ["jud", "jd"], ["유"]],
  ["Revelation", "요한계시록", 22, ["rev", "re", "rv", "revelations", "apocalypse"], ["계", "계시록"]],
];

const NUMBER_PREFIXES = {
  1: ["1", "i", "1st", "first"],
  2: ["2", "ii", "2nd", "second"],
  3: ["3", "iii", "3rd", "third"],
};

export const BOOKS = RAW.map(([en, ko, chapters, enAliases, koAliases], index) => {
  const numbered = en.match(/^([123]) (.+)$/);
  return {
    index,
    en,
    ko,
    chapters,
    number: numbered ? Number(numbered[1]) : null,
    baseName: numbered ? numbered[2] : en,
    enAliases,
    koAliases,
  };
});

/** Normalise a book name the way the alias map is keyed: lowercase, no spaces/dots. */
export function normalizeBookName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[\s.·]/g, "");
}

function buildAliasMap() {
  const map = new Map();
  const add = (alias, book) => {
    const key = normalizeBookName(alias);
    if (key && !map.has(key)) map.set(key, book);
  };
  for (const book of BOOKS) {
    add(book.en, book);
    add(book.ko, book);
    book.koAliases.forEach((a) => add(a, book));
    if (book.number) {
      for (const prefix of NUMBER_PREFIXES[book.number]) {
        add(`${prefix}${book.baseName}`, book);
        book.enAliases.forEach((a) => add(`${prefix}${a}`, book));
      }
    } else {
      book.enAliases.forEach((a) => add(a, book));
    }
  }
  return map;
}

export const BOOK_ALIAS_MAP = buildAliasMap();

export function findBook(name) {
  return BOOK_ALIAS_MAP.get(normalizeBookName(name)) ?? null;
}
