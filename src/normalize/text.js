/**
 * Small text helpers shared by the normalizer.
 */

const ENTITIES = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&ndash;": "–",
  "&mdash;": "—",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
  "&times;": "×",
};

function decodeEntities(text = "") {
  return String(text)
    .replace(/&[a-z]+;|&#0?39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Notes the supplier left on its own pages, e.g. "[Intern: copy from live page]". */
const INTERNAL_NOTE = /\s*\[\s*intern\b[^\]]*\]/gi;

function stripInternalNotes(text = "") {
  return String(text).replace(INTERNAL_NOTE, "");
}

/** Single-line clean: entities, NBSP, smart quotes, internal notes, whitespace. */
function cleanLine(text = "") {
  return stripInternalNotes(decodeEntities(text))
    .replace(/ /g, " ")
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Multi-line clean: same as cleanLine but keeps paragraph breaks. */
function cleanBlock(text = "") {
  return stripInternalNotes(decodeEntities(text))
    .replace(/ /g, " ")
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, lines) => line || (i > 0 && lines[i - 1]))
    .join("\n")
    .trim();
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

// Kept upper-case when title-casing an ALL-CAPS name.
const ACRONYMS = new Set([
  "TT", "USI", "PVC", "EZ", "MMA", "TFT", "LED", "LCD", "PU", "NBR", "TPE", "EVA",
  "HIIT", "XL", "XXL", "XS", "AC", "DC", "HP", "MB", "HE", "XP", "UV", "MS", "BT", "FID", "FTSM",
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII",
]);

const UNITS = { KG: "kg", KGS: "kg", MM: "mm", CM: "cm", LB: "lb", LBS: "lbs", FT: "ft", M: "m" };

function titleCaseWord(word, isFirst) {
  // Model codes ("AF-106", "X-500", "AF-602AS") stay exactly as they are.
  if (/^[A-Z]{1,4}-?\d/i.test(word) && /\d/.test(word)) return word;

  // Recurse into hyphenated / slashed words: "PULL-DOWN" -> "Pull-Down", "3-JELLY" -> "3-Jelly"
  if (/[-/]/.test(word)) {
    return word
      .split(/([-/])/)
      .map((part, i) => (/[-/]/.test(part) ? part : titleCaseWord(part, isFirst && i === 0)))
      .join("");
  }

  // Numbers stay, except trailing units ("28MM" -> "28mm").
  if (/\d/.test(word)) {
    return word.replace(/^(\d+(?:\.\d+)?)(KGS?|MM|CM|LBS?|FT)$/i, (_, n, u) => n + UNITS[u.toUpperCase()]);
  }

  const bare = word.replace(/[^A-Za-z]/g, "");
  if (ACRONYMS.has(bare)) return word;
  if (UNITS[bare] && bare.length > 1) return word.replace(bare, UNITS[bare]);

  const lower = word.toLowerCase();
  if (!isFirst && SMALL_WORDS.has(lower)) return lower;

  return lower.replace(/[a-z]/, (c) => c.toUpperCase());
}

/** Title-case a name only if it is entirely upper-case. */
function fixAllCaps(name = "") {
  const letters = name.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return name;

  return name
    .split(" ")
    .map((word, i) => (word ? titleCaseWord(word, i === 0) : word))
    .join(" ");
}

/** HTML -> text with a line break per paragraph / list item / row. */
function htmlToText(html = "") {
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|h\d|tr|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

module.exports = {
  htmlToText,
  decodeEntities,
  stripInternalNotes,
  cleanLine,
  cleanBlock,
  fixAllCaps,
};
