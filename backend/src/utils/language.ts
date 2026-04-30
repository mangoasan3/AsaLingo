import type { CefrLevel } from "../models";
import { DEFAULT_TOPIC, TOPIC_ALIASES, TOPIC_KEYS, type TopicKey } from "../constants/topics";

export type SupportedLanguageCode =
  | "en"
  | "ru"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ja"
  | "ko"
  | "zh";

type LanguageMeta = {
  code: SupportedLanguageCode;
  name: string;
  aliases: string[];
};

const LANGUAGE_META: LanguageMeta[] = [
  { code: "en", name: "English", aliases: ["en", "eng", "english", "английский"] },
  { code: "ru", name: "Russian", aliases: ["ru", "rus", "russian", "русский", "русская", "рус"] },
  { code: "es", name: "Spanish", aliases: ["es", "esp", "spanish", "espanol", "español", "испанский"] },
  { code: "fr", name: "French", aliases: ["fr", "fra", "french", "francais", "français", "французский"] },
  { code: "de", name: "German", aliases: ["de", "deu", "german", "deutsch", "немецкий"] },
  { code: "it", name: "Italian", aliases: ["it", "ita", "italian", "italiano", "итальянский"] },
  { code: "pt", name: "Portuguese", aliases: ["pt", "por", "portuguese", "portugues", "português", "brazilian portuguese", "португальский"] },
  { code: "ja", name: "Japanese", aliases: ["ja", "jpn", "japanese", "nihongo", "日本語", "японский"] },
  { code: "ko", name: "Korean", aliases: ["ko", "kor", "korean", "한국어", "корейский"] },
  { code: "zh", name: "Chinese", aliases: ["zh", "zho", "chinese", "mandarin", "中文", "汉语", "китайский"] },
];

const ALIAS_TO_CODE = new Map<string, SupportedLanguageCode>();
const CODE_TO_NAME = new Map<SupportedLanguageCode, string>();

for (const meta of LANGUAGE_META) {
  CODE_TO_NAME.set(meta.code, meta.name);
  for (const alias of meta.aliases) {
    ALIAS_TO_CODE.set(alias.toLowerCase(), meta.code);
  }
}

const NATIVE_LANGUAGE_ALIASES: Record<SupportedLanguageCode, string[]> = {
  en: ["английский", "english language"],
  ru: ["русский", "русская", "рус"],
  es: ["español", "испанский"],
  fr: ["français", "французский"],
  de: ["немецкий"],
  it: ["итальянский"],
  pt: ["português", "португальский"],
  ja: ["日本語", "にほんご", "японский"],
  ko: ["한국어", "조선말", "корейский"],
  zh: ["中文", "汉语", "普通话", "китайский"],
};

for (const [code, aliases] of Object.entries(NATIVE_LANGUAGE_ALIASES) as Array<
  [SupportedLanguageCode, string[]]
>) {
  for (const alias of aliases) {
    ALIAS_TO_CODE.set(alias.toLowerCase(), code);
  }
}

export function normalizeLanguageCode(
  input?: string | null,
  fallback: SupportedLanguageCode = "en"
): SupportedLanguageCode {
  if (!input) return fallback;
  return ALIAS_TO_CODE.get(input.trim().toLowerCase()) ?? fallback;
}

export function getLanguageName(input?: string | null): string {
  const code = normalizeLanguageCode(input);
  return CODE_TO_NAME.get(code) ?? "English";
}

export function getExplanationLanguageCode(
  level: CefrLevel,
  nativeLanguage: string,
  targetLanguage: string
): SupportedLanguageCode {
  if (level === "B2" || level === "C1" || level === "C2") {
    return normalizeLanguageCode(targetLanguage);
  }

  return normalizeLanguageCode(nativeLanguage, "ru");
}

export function normalizeTopic(topic?: string | null, fallback: TopicKey = DEFAULT_TOPIC): TopicKey {
  if (!topic) return fallback;
  const normalized = topic.trim().toLowerCase();
  if ((TOPIC_KEYS as readonly string[]).includes(normalized)) {
    return normalized as TopicKey;
  }
  return TOPIC_ALIASES[normalized] ?? fallback;
}

export function normalizeTopics(topics?: string[] | null): TopicKey[] {
  if (!topics || topics.length === 0) return [];
  return [...new Set(topics.map((topic) => normalizeTopic(topic)).filter(Boolean))];
}

export function getBeginnerTopicHints(level: CefrLevel): string[] {
  if (level === "A1") {
    return [
      "greetings",
      "pronouns",
      "numbers",
      "polite expressions",
      "survival vocabulary",
      "daily essentials",
      "simple verbs",
    ];
  }

  if (level === "A2") {
    return [
      "daily routines",
      "shopping",
      "travel basics",
      "family",
      "time and dates",
      "common actions",
    ];
  }

  if (level === "B1") {
    return [
      "opinions",
      "plans",
      "work and study",
      "relationships",
      "health",
      "everyday problem solving",
    ];
  }

  return [];
}

export function buildLanguagePairKey(targetLanguage: string, nativeLanguage: string): string {
  return `${normalizeLanguageCode(nativeLanguage)}->${normalizeLanguageCode(targetLanguage)}`;
}
