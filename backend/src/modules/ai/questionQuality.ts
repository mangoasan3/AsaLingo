const BLANK_PATTERN = /_{3,}|\[\s*blank\s*\]|<blank>/i;
const META_TRANSLATION_PATTERN =
  /\b(meaning|translation|translate|definition|word|option|answer|prompt|blank|context)\b/i;

function cleanText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeText(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isSuspiciousPromptTranslation(value: string): boolean {
  const cleaned = cleanText(value);
  const normalized = normalizeText(cleaned);

  if (!normalized || normalized.length < 2) return true;
  if (META_TRANSLATION_PATTERN.test(cleaned)) return true;
  return false;
}

export function pickPromptTranslation(primary: string, fallback?: string): string {
  const preferred = cleanText(primary);
  if (preferred && !isSuspiciousPromptTranslation(preferred)) return preferred;

  const safeFallback = cleanText(fallback);
  if (safeFallback && !isSuspiciousPromptTranslation(safeFallback)) return safeFallback;

  return "";
}

export function isMeaningfulFillBlankSentence(value: string): boolean {
  const sentence = cleanText(value);
  if (!sentence || !BLANK_PATTERN.test(sentence)) return false;

  const withoutBlank = sentence
    .replace(BLANK_PATTERN, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutBlank.split(" ").filter(Boolean).length >= 2;
}

export function buildFallbackFillBlankSentence(exampleSentence: string, answer: string): string {
  const example = cleanText(exampleSentence);
  const target = cleanText(answer);

  if (!example || !target) return "";

  const pattern = new RegExp(`\\b${escapeRegExp(target)}\\b`, "i");
  if (!pattern.test(example)) return "";

  return example.replace(pattern, "_____");
}

export function pickFillBlankSentence(
  primarySentence: string,
  answer: string,
  fallbackExampleSentence?: string
): string {
  const preferred = cleanText(primarySentence);
  if (isMeaningfulFillBlankSentence(preferred)) return preferred;

  const fallback = buildFallbackFillBlankSentence(fallbackExampleSentence ?? "", answer);
  return isMeaningfulFillBlankSentence(fallback) ? fallback : "";
}
