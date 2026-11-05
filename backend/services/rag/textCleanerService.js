/**
 * Builds a regex pattern that can match phrases whose
 * letters may be separated by inconsistent spaces.
 *
 * Example:
 * "focus of family therapy"
 *
 * Can match:
 * "f o c u s o f fa m i ly t h e r a p y"
 *
 * @param {string} phrase
 * @returns {string}
 */
const spacedPhrasePattern = (phrase) => {
  const compactPhrase = phrase.replace(/\s+/g, "");

  return compactPhrase
    .split("")
    .map((char) => {
      if (/[.*+?^${}()|[\]\\]/.test(char)) {
        return `\\${char}`;
      }

      return char;
    })
    .join("\\s*");
};

/**
 * Cleans common PDF extraction noise while preserving
 * meaningful counseling/reference content.
 *
 * @param {string} text - Raw extracted PDF text.
 * @returns {string}
 */
const cleanPdfText = (text) => {
  if (!text || typeof text !== "string") {
    return "";
  }

  let cleanedText = text;

  /*
   * -------------------------------------------------
   * 1. NORMALIZE LINE ENDINGS
   * -------------------------------------------------
   */

  cleanedText = cleanedText.replace(/\r\n?/g, "\n");

  // Worksheet answer rules carry no instructions and should not consume chunk
  // space or separate the prompts belonging to the same exercise.
  cleanedText = cleanedText.replace(/_{3,}/g, " ");

  /*
   * -------------------------------------------------
   * 2. REMOVE PDF / PUBLISHER NOISE
   * -------------------------------------------------
   */

  /*
   * Remove properly extracted Cengage copyright /
   * electronic-rights boilerplate.
   */
  cleanedText = cleanedText.replace(
    /Copyright[\s\S]*?Cengage Learning reserves the right to remove additional content at any time if subsequent rights restrictions require it\./gi,
    " "
  );

  /*
   * Remove common copyright boilerplate when the
   * wording is mostly intact but slightly different.
   */
  cleanedText = cleanedText.replace(
    /Copyright\s+\d{4}[\s\S]{0,1200}?rights?\s+reserved[\s\S]{0,1200}?(?:rights restrictions require it|subsequent editions|electronic rights)/gi,
    " "
  );

  /*
   * Remove InDesign production codes.
   *
   * Handles:
   *
   * 28549_ch15_rev01.indd 462 ...
   * 28549_ch15_rev01. indd 462 ...
   */
  cleanedText = cleanedText.replace(
    /\b\d+_ch\d+_[^\s]*\.\s*indd\s+\d+\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?/gi,
    " "
  );

  /*
   * Remove remaining InDesign code when the
   * timestamp is formatted differently.
   */
  cleanedText = cleanedText.replace(/\b\d+_ch\d+_[^\s]*\.\s*indd\s+\d+/gi, " ");

  /*
   * Remove leftover standalone production timestamps.
   *
   * Example:
   * 20/09/11 4:00 PM
   */
  cleanedText = cleanedText.replace(
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi,
    " "
  );

  /*
   * Remove extraction markers such as:
   * "-- 1 of 13 --"
   */
  cleanedText = cleanedText.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ");

  /*
   * Remove standalone page number
   * at the beginning.
   */
  cleanedText = cleanedText.replace(/^\s*\d{1,4}\s*(?:\n|\s)+/, "");

  /*
   * -------------------------------------------------
   * 3. NORMALIZE SPACED-OUT HEADINGS
   * -------------------------------------------------
   */

  const headingReplacements = [
    {
      phrase: "family systems therapy",
      replacement: "Family Systems Therapy",
    },
    {
      phrase: "an integrative perspective",
      replacement: "An Integrative Perspective",
    },
    {
      phrase: "chapter fourteen",
      replacement: "Chapter Fourteen",
    },
    {
      phrase: "chapter fifteen",
      replacement: "Chapter Fifteen",
    },
    {
      phrase: "chapter sixteen",
      replacement: "Chapter Sixteen",
    },
    {
      phrase: "basic assumption",
      replacement: "Basic Assumption",
    },
    {
      phrase: "focus of family therapy",
      replacement: "Focus of Family Therapy",
    },
    {
      phrase: "where to go from here",
      replacement: "Where to Go From Here",
    },
    {
      phrase: "counseling stan: integration of therapies",
      replacement: "Counseling Stan: Integration of Therapies",
    },
    {
      phrase: "subject index",
      replacement: "Subject Index",
    },
    {
      phrase: "name index",
      replacement: "Name Index",
    },
    {
      phrase: "chapter one",
      replacement: "Chapter One",
    },
    {
      phrase: "introduction and overview",
      replacement: "Introduction and Overview",
    },
  ];

  for (const { phrase, replacement } of headingReplacements) {
    const pattern = new RegExp(spacedPhrasePattern(phrase), "gi");

    cleanedText = cleanedText.replace(pattern, `${replacement} `);
  }

  /*
   * -------------------------------------------------
   * 4. FIX LINE-BREAK EXTRACTION
   * -------------------------------------------------
   */

  /*
   * Preserve hyphenated words split across lines.
   *
   * Example:
   *
   * self-
   * defeating
   *
   * becomes:
   *
   * self-defeating
   */
  cleanedText = cleanedText.replace(/([A-Za-z])-\s*\n\s*([a-z])/g, "$1-$2");

  /*
   * Join ordinary paragraph lines where the next
   * line begins with a lowercase character.
   */
  cleanedText = cleanedText.replace(/(?<![.!?:;])\n(?=[a-z])/g, " ");

  /*
   * -------------------------------------------------
   * 5. NORMALIZE WHITESPACE
   * -------------------------------------------------
   */

  cleanedText = cleanedText.replace(/[ \t]{2,}/g, " ");

  cleanedText = cleanedText.replace(/\s+([,.;:!?])/g, "$1");

  cleanedText = cleanedText.replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ");

  cleanedText = cleanedText
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  cleanedText = cleanedText.replace(/\n{3,}/g, "\n\n");

  return cleanedText.trim();
};

/*
 * -------------------------------------------------
 * COMMON ENGLISH WORDS
 * -------------------------------------------------
 */

const COMMON_ENGLISH_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "him",
  "his",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "more",
  "not",
  "of",
  "on",
  "or",
  "our",
  "she",
  "should",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "through",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/**
 * Converts text into simplified alphabetic words.
 *
 * @param {string} text
 * @returns {Array<string>}
 */
const getAlphabeticWords = (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }

  return text
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ""))
    .filter(Boolean);
};

/**
 * Calculates the proportion of common English words.
 *
 * @param {Array<string>} words
 * @returns {number}
 */
const getCommonWordRatio = (words) => {
  if (!Array.isArray(words) || words.length === 0) {
    return 0;
  }

  const commonEnglishWords = words.filter((word) => COMMON_ENGLISH_WORDS.has(word.toLowerCase()));

  return commonEnglishWords.length / words.length;
};

/**
 * Checks native PDF-extracted text.
 *
 * Native extraction remains relatively permissive
 * because headings, tables, indexes, and references
 * may not resemble ordinary paragraph text.
 *
 * @param {string} text
 * @returns {boolean}
 */
const isReadablePdfText = (text) => {
  if (!text || typeof text !== "string" || !text.trim()) {
    return false;
  }

  const cleanedText = text.trim();

  /*
   * Very short native text may still be a valid
   * heading or small section.
   */
  if (cleanedText.length < 100) {
    return true;
  }

  const words = getAlphabeticWords(cleanedText);

  if (words.length === 0) {
    return false;
  }

  /*
   * -------------------------------------------------
   * CHECK 1:
   * EXCESSIVELY LONG ALPHABETIC STRINGS
   * -------------------------------------------------
   */

  const unusuallyLongWords = words.filter((word) => word.replace(/[^A-Za-z]/g, "").length > 25);

  const longWordRatio = unusuallyLongWords.length / words.length;

  if (longWordRatio > 0.1) {
    return false;
  }

  /*
   * -------------------------------------------------
   * CHECK 2:
   * COMMON ENGLISH WORD FREQUENCY
   * -------------------------------------------------
   */

  const commonWordRatio = getCommonWordRatio(words);

  /*
   * -------------------------------------------------
   * CHECK 3:
   * EXCESSIVE UPPERCASE WORDS
   * -------------------------------------------------
   */

  const alphabeticWords = words.filter((word) => /^[A-Za-z]+$/.test(word));

  const uppercaseWords = alphabeticWords.filter(
    (word) => word.length >= 4 && word === word.toUpperCase()
  );

  const uppercaseWordRatio =
    alphabeticWords.length > 0 ? uppercaseWords.length / alphabeticWords.length : 0;

  /*
   * -------------------------------------------------
   * CHECK 4:
   * EXCESSIVE WORDS WITHOUT VOWELS
   * -------------------------------------------------
   */

  const meaningfulWords = alphabeticWords.filter((word) => word.length >= 4);

  const wordsWithoutVowels = meaningfulWords.filter((word) => !/[aeiou]/i.test(word));

  const noVowelRatio =
    meaningfulWords.length > 0 ? wordsWithoutVowels.length / meaningfulWords.length : 0;

  /*
   * -------------------------------------------------
   * CHECK 5:
   * KNOWN ENCODED-LOOKING TOKENS
   * -------------------------------------------------
   */

  const suspiciousTokens = new Set([
    "UIF",
    "BOE",
    "QSP",
    "DPO",
    "JOU",
    "NPEFM",
    "SFMBUJPOTIJQ",
    "QFSTPO",
    "UIFSBQZ",
    "DPVOTFMJOH",
    "GBNJMZ",
    "DMJFOU",
    "QSPCMFN",
    "DIBOHF",
    "QSPDFTT",
    "TUSVDUVSF",
    "VOEFSTUBOEJOH",
    "JOUFSWFOUJPO",
    "BQQSPBDI",
  ]);

  const suspiciousTokenCount = words.filter((word) =>
    suspiciousTokens.has(word.toUpperCase())
  ).length;

  const suspiciousTokenRatio = suspiciousTokenCount / words.length;

  /*
   * -------------------------------------------------
   * FINAL NATIVE-TEXT DECISION
   * -------------------------------------------------
   */

  const suspiciousUppercaseText = uppercaseWordRatio > 0.4 && commonWordRatio < 0.06;

  const suspiciousLanguagePattern = commonWordRatio < 0.02 && noVowelRatio > 0.2;

  const suspiciousEncodedText = suspiciousTokenRatio > 0.03;

  if (suspiciousUppercaseText || suspiciousLanguagePattern || suspiciousEncodedText) {
    return false;
  }

  return true;
};

/**
 * Detects likely copyright / publisher boilerplate.
 *
 * OCR may misspell some words, so several related
 * indicators are checked instead of relying on one
 * exact sentence.
 *
 * @param {string} text
 * @returns {boolean}
 */
const isLikelyPublisherBoilerplate = (text) => {
  if (!text || typeof text !== "string") {
    return false;
  }

  const normalized = text.toLowerCase().replace(/\s+/g, " ");

  const patterns = [
    /\bcopyright\b/i,

    /*
     * Correct and common OCR-misread
     * versions of Cengage.
     */
    /\bcengage\b/i,
    /\bcongage\b/i,
    /\bcengag[e3]\b/i,

    /\bright[s]?\b/i,
    /\breserved\b/i,
    /\bcop(?:y|ied|ying)\b/i,
    /\be-?book\b/i,
    /\belectronic\b/i,
    /\bcontent\b/i,
    /\brestriction[s]?\b/i,
    /\blearning\b/i,
    /\bedition[s]?\b/i,
  ];

  const matchedCategories = patterns.reduce(
    (count, pattern) => (pattern.test(normalized) ? count + 1 : count),
    0
  );

  /*
   * A normal textbook paragraph might contain
   * one or two of these words.
   *
   * Four or more on a relatively short page is
   * much more characteristic of publisher
   * boilerplate.
   */
  return matchedCategories >= 4 && normalized.length < 1800;
};

/**
 * Checks OCR text more strictly than native PDF text.
 *
 * OCR should only be accepted when there is enough
 * evidence of meaningful readable content.
 *
 * @param {string} text
 * @returns {boolean}
 */
const isReadableOcrText = (text) => {
  if (!text || typeof text !== "string" || !text.trim()) {
    return false;
  }

  const cleanedText = text.trim();

  /*
   * -------------------------------------------------
   * CHECK 1:
   * MINIMUM OCR CONTENT
   * -------------------------------------------------
   */

  if (cleanedText.length < 60) {
    return false;
  }

  /*
   * -------------------------------------------------
   * CHECK 2:
   * PUBLISHER / COPYRIGHT BOILERPLATE
   * -------------------------------------------------
   */

  if (isLikelyPublisherBoilerplate(cleanedText)) {
    return false;
  }

  /*
   * Reuse the original native PDF checks first.
   */
  isReadableOcrText();

  const words = getAlphabeticWords(cleanedText);

  /*
   * OCR containing only a few recognized tokens
   * is too uncertain.
   */
  if (words.length < 8) {
    return false;
  }

  const alphabeticWords = words.filter((word) => /^[A-Za-z]+$/.test(word));

  if (alphabeticWords.length < 6) {
    return false;
  }

  const commonWordRatio = getCommonWordRatio(words);

  /*
   * -------------------------------------------------
   * CHECK 3:
   * SUSPICIOUS VERY SHORT OCR TOKENS
   * -------------------------------------------------
   */

  const suspiciousShortWords = alphabeticWords.filter((word) => {
    const lower = word.toLowerCase();

    return word.length <= 2 && !COMMON_ENGLISH_WORDS.has(lower);
  });

  const suspiciousShortRatio =
    alphabeticWords.length > 0 ? suspiciousShortWords.length / alphabeticWords.length : 0;

  /*
   * -------------------------------------------------
   * CHECK 4:
   * VOWEL-LESS OCR WORDS
   * -------------------------------------------------
   */

  const meaningfulWords = alphabeticWords.filter((word) => word.length >= 4);

  const wordsWithoutVowels = meaningfulWords.filter((word) => !/[aeiou]/i.test(word));

  const noVowelRatio =
    meaningfulWords.length > 0 ? wordsWithoutVowels.length / meaningfulWords.length : 0;

  /*
   * -------------------------------------------------
   * CHECK 5:
   * NORMAL CHARACTER RATIO
   * -------------------------------------------------
   */

  const compactText = cleanedText.replace(/\s/g, "");

  if (compactText.length === 0) {
    return false;
  }

  const normalCharacters = compactText.match(/[A-Za-z0-9.,;:!?'"()\-–—/&+]/g) || [];

  const normalCharacterRatio = normalCharacters.length / compactText.length;

  /*
   * -------------------------------------------------
   * CHECK 6:
   * STRANGE OCR SYMBOLS
   * -------------------------------------------------
   */

  const strangeCharacters = compactText.match(/[^A-Za-z0-9.,;:!?'"()\-–—/&+]/g) || [];

  const strangeCharacterRatio = strangeCharacters.length / compactText.length;

  /*
   * -------------------------------------------------
   * FINAL OCR DECISION
   * -------------------------------------------------
   *
   * These thresholds are intentionally more
   * permissive than the previous version.
   *
   * This allows legitimate OCR pages containing
   * headings, bullet lists, and short phrases while
   * still rejecting heavily corrupted output.
   */

  const suspiciousFragmentedText = commonWordRatio < 0.025 && suspiciousShortRatio > 0.25;

  const suspiciousWordStructure = commonWordRatio < 0.025 && noVowelRatio > 0.22;

  const suspiciousCharacters = normalCharacterRatio < 0.7 || strangeCharacterRatio > 0.3;

  if (suspiciousFragmentedText || suspiciousWordStructure || suspiciousCharacters) {
    return false;
  }

  return true;
};

module.exports = {
  cleanPdfText,
  isReadablePdfText,
  isReadableOcrText,
};
