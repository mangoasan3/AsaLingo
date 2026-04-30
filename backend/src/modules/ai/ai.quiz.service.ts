import crypto from "crypto";
import { VocabularyWord, UserWord, AIContentCache, LearningSession } from "../../models";
import type {
  CefrLevel,
  ICurriculumNode,
  IMediaTask,
  IUser,
  IVocabularyWord,
  PartOfSpeech,
  ScriptStage,
  SkillFocus,
} from "../../models";
import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import {
  buildLanguagePairKey,
  getBeginnerTopicHints,
  getExplanationLanguageCode,
  getLanguageName,
  normalizeLanguageCode,
  normalizeTopic,
} from "../../utils/language";
import { DEFAULT_TOPIC, TOPIC_KEYS } from "../../constants/topics";
import { buildLearningContext } from "../learning/learningContext.service";
import { getExerciseMetadata } from "../learning/exerciseCatalog";
import type { ExerciseType } from "../learning/exerciseCatalog";
import {
  buildImageUrl as buildImageUrlFromHelpers,
  getMediaBlank as getMediaBlankFromHelpers,
  isDisallowedPlaceholderImageUrl,
  isImageFriendlyWord as isImageFriendlyWordFromHelpers,
} from "./mediaHelpers";
import { pickFillBlankSentence, pickPromptTranslation } from "./questionQuality";
import {
  getErrorCorrectionPrompt,
  getGuidedWritingTexts,
  getMediaComprehensionPrompt,
  getMediaExercisePrompt,
  getOpenTranslationTexts,
  getScriptExercisePrompt,
  getSentenceWritingPrompt,
} from "./roadmapPrompts";
import type {
  QuizAnswerEvaluation,
  QuizEvaluationStatus,
  FillBlankQuizQuestion,
  ReverseMultipleChoiceQuizQuestion,
  ImageBasedQuizQuestion,
  MultipleChoiceQuizQuestion,
  PublicQuizQuestion,
  QuizQuestion,
  QuizWordInfo,
  SentenceWritingQuizQuestion,
  TranslationInputQuizQuestion,
} from "./quiz.types";

interface AiClientConfig {
  apiKey: string;
  model: string;
  label: string;
}

class AiCallError extends Error {
  status?: number;
  retryAfterMs?: number;
  transient?: boolean;

  constructor(
    message: string,
    options: { status?: number; retryAfterMs?: number; transient?: boolean } = {}
  ) {
    super(message);
    this.name = "AiCallError";
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.transient = options.transient;
  }
}

const AI_KEY_CHAIN: AiClientConfig[] = [
  {
    apiKey: env.DEEPSEEK_API_KEY,
    model: "deepseek-chat",
    label: "DeepSeek API key",
  },
];
const configuredAiClients = AI_KEY_CHAIN.filter((item) => item.apiKey.trim().length > 0);
const AI_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const AI_TRANSIENT_COOLDOWN_MS = 30 * 1000;
const aiClientCooldownUntil = new Map<string, number>();
const AI_SOURCE_FILTER = { sourceType: { $in: ["ai-generated", "seed"] } };
const PARTS_OF_SPEECH: PartOfSpeech[] = [
  "NOUN",
  "VERB",
  "ADJECTIVE",
  "ADVERB",
  "PREPOSITION",
  "CONJUNCTION",
  "PRONOUN",
  "INTERJECTION",
  "PHRASE",
];
const QUESTION_TARGET_COUNT = 10;

// Native-language question instructions for local deterministic exercises.
// Keys map to template type; values map nativeLanguage code → instruction generator.
type InstructionFn = (word: string) => string;
const LOCAL_QUESTION_INSTRUCTIONS: Record<string, Partial<Record<string, InstructionFn>>> = {
  choose_meaning: {
    en: (w) => `What does "${w}" mean?`,
    ru: (w) => `Что означает слово «${w}»?`,
    es: (w) => `¿Qué significa "${w}"?`,
    fr: (w) => `Que signifie «${w}» ?`,
    de: (w) => `Was bedeutet „${w}"?`,
    it: (w) => `Cosa significa "${w}"?`,
    pt: (w) => `O que significa "${w}"?`,
    ja: (w) => `「${w}」の意味を選んでください。`,
    ko: (w) => `"${w}"의 뜻을 고르세요.`,
    zh: (w) => `"${w}"是什么意思？`,
  },
  choose_translation: {
    en: (w) => `Choose the translation of "${w}".`,
    ru: (w) => `Выберите перевод слова «${w}».`,
    es: (w) => `Elige la traducción de "${w}".`,
    fr: (w) => `Choisissez la traduction de «${w}».`,
    de: (w) => `Wähle die Übersetzung von „${w}".`,
    it: (w) => `Scegli la traduzione di "${w}".`,
    pt: (w) => `Escolha a tradução de "${w}".`,
    ja: (w) => `「${w}」の翻訳を選んでください。`,
    ko: (w) => `"${w}"의 번역을 고르세요.`,
    zh: (w) => `选择"${w}"的翻译。`,
  },
  complete_sentence: {
    en: () => `Complete the sentence with the missing word.`,
    ru: () => `Заполните пропуск подходящим словом.`,
    es: () => `Completa la oración con la palabra que falta.`,
    fr: () => `Complétez la phrase avec le mot manquant.`,
    de: () => `Ergänze den Satz mit dem fehlenden Wort.`,
    it: () => `Completa la frase con la parola mancante.`,
    pt: () => `Complete a frase com a palavra que falta.`,
    ja: () => `空欄に入る言葉を選んでください。`,
    ko: () => `빈칸에 알맞은 단어를 고르세요.`,
    zh: () => `选择合适的词填入空白处。`,
  },
  which_word_matches: {
    en: (t) => `Which word matches "${t}"?`,
    ru: (t) => `Какое слово соответствует «${t}»?`,
    es: (t) => `¿Qué palabra corresponde a "${t}"?`,
    fr: (t) => `Quel mot correspond à «${t}» ?`,
    de: (t) => `Welches Wort passt zu „${t}"?`,
    it: (t) => `Quale parola corrisponde a "${t}"?`,
    pt: (t) => `Qual palavra corresponde a "${t}"?`,
    ja: (t) => `「${t}」に対応する言葉を選んでください。`,
    ko: (t) => `"${t}"에 해당하는 단어를 고르세요.`,
    zh: (t) => `哪个词与"${t}"对应？`,
  },
  read_and_choose_meaning: {
    en: (w) => `Read the sentence. What does "${w}" mean in this context?`,
    ru: (w) => `Прочитайте предложение. Что означает «${w}» в этом контексте?`,
    es: (w) => `Lee la oración. ¿Qué significa "${w}" en este contexto?`,
    fr: (w) => `Lisez la phrase. Que signifie «${w}» dans ce contexte ?`,
    de: (w) => `Lese den Satz. Was bedeutet „${w}" in diesem Kontext?`,
    it: (w) => `Leggi la frase. Cosa significa "${w}" in questo contesto?`,
    pt: (w) => `Leia a frase. O que significa "${w}" neste contexto?`,
    ja: (w) => `文を読んで、「${w}」の文脈での意味を選んでください。`,
    ko: (w) => `문장을 읽고 "${w}"의 문맥상 의미를 고르세요.`,
    zh: (w) => `阅读句子，选择"${w}"在语境中的含义。`,
  },
  paraphrase_meaning: {
    en: (w) => `What is the meaning of "${w}" as used in the sentence above?`,
    ru: (w) => `Каково значение слова «${w}» в приведённом предложении?`,
    es: (w) => `¿Cuál es el significado de "${w}" en la oración anterior?`,
    fr: (w) => `Quel est le sens de «${w}» dans la phrase ci-dessus ?`,
    de: (w) => `Was bedeutet „${w}" im obigen Satz?`,
    it: (w) => `Qual è il significato di "${w}" nella frase sopra?`,
    pt: (w) => `Qual é o significado de "${w}" na frase acima?`,
    ja: (w) => `上の文での「${w}」の意味を選んでください。`,
    ko: (w) => `위 문장에서 "${w}"의 의미를 고르세요.`,
    zh: (w) => `"${w}"在上文句子中的含义是什么？`,
  },
  choose_word_for_image: {
    en: () => `Look at the image and choose the matching word.`,
    ru: () => `Посмотрите на изображение и выберите подходящее слово.`,
    es: () => `Mira la imagen y elige la palabra correcta.`,
    fr: () => `Regardez l'image et choisissez le mot correspondant.`,
    de: () => `Sieh dir das Bild an und wähle das passende Wort.`,
    it: () => `Guarda l'immagine e scegli la parola corrispondente.`,
    pt: () => `Olhe para a imagem e escolha a palavra correspondente.`,
    ja: () => `画像を見て、合う言葉を選んでください。`,
    ko: () => `그림을 보고 알맞은 단어를 고르세요.`,
    zh: () => `看图，选择匹配的词。`,
  },
  reorder_words: {
    en: () => `Put the words in the correct order.`,
    ru: () => `Расставьте слова в правильном порядке.`,
    es: () => `Ordena las palabras correctamente.`,
    fr: () => `Mettez les mots dans le bon ordre.`,
    de: () => `Bringe die Wörter in die richtige Reihenfolge.`,
    it: () => `Metti le parole nell'ordine corretto.`,
    pt: () => `Coloque as palavras na ordem correta.`,
    ja: () => `語句を正しい順序に並べてください。`,
    ko: () => `단어를 올바른 순서로 배열하세요.`,
    zh: () => `将单词排列成正确顺序。`,
  },
  match_words: {
    en: () => `Match each word with its meaning.`,
    ru: () => `Сопоставьте каждое слово с его значением.`,
    es: () => `Empareja cada palabra con su significado.`,
    fr: () => `Associez chaque mot à sa signification.`,
    de: () => `Ordne jedem Wort seine Bedeutung zu.`,
    it: () => `Abbina ogni parola al suo significato.`,
    pt: () => `Relacione cada palavra com o seu significado.`,
    ja: () => `それぞれの言葉を意味と結びつけてください。`,
    ko: () => `각 단어를 알맞은 뜻과 연결하세요.`,
    zh: () => `将每个词与其含义相匹配。`,
  },
};

function getLocalInstruction(key: keyof typeof LOCAL_QUESTION_INSTRUCTIONS, nativeLang: string, word = ""): string {
  const table = LOCAL_QUESTION_INSTRUCTIONS[key] ?? {};
  const lang = nativeLang in table ? nativeLang : "en";
  const fn = (table[lang] ?? table["en"]) as InstructionFn | undefined;
  return fn?.(word) ?? word;
}

const LEVEL_DESCRIPTIONS: Record<CefrLevel, string> = {
  A1: "absolute beginner. Use greetings, pronouns, numbers, polite expressions, survival words, and simple verbs only.",
  A2: "elementary learner. Use common daily vocabulary for practical routines and basic conversations.",
  B1: "lower intermediate learner. Use useful everyday vocabulary with clear, practical contexts.",
  B2: "upper intermediate learner. Use natural, precise vocabulary with more context and nuance.",
  C1: "advanced learner. Use nuanced, accurate, flexible vocabulary.",
  C2: "near-native learner. Use subtle, sophisticated vocabulary naturally.",
};

export function isAiConfigured(): boolean {
  return configuredAiClients.length > 0;
}

interface GenerateWordsParams {
  level: CefrLevel;
  targetLanguage: string;
  nativeLanguage: string;
  topic?: string;
  count?: number;
  lessonStep?: string;
  progressionStep?: number;
  vocabularyHints?: string[];
}

interface GeneratedWordPayload {
  word: string;
  translation: string;
  definition: string;
  partOfSpeech: PartOfSpeech;
  topic: string;
  exampleSentence: string;
  easierExplanation: string;
  synonyms: string[];
  collocations: string[];
  pronunciation?: string;
  lessonStep?: string;
  progressionStep?: number;
}

interface RoadmapExerciseGenerationParams {
  user: IUser;
  node: ICurriculumNode;
  words: IVocabularyWord[];
  mode: "lesson" | "review" | "challenge";
  exerciseTypes: ExerciseType[];
  recentQuestionHashes?: string[];
  recentWordIds?: string[];
  media?: IMediaTask | null;
  count?: number;
}

interface PlacementItemGenerationParams {
  language: string;
  nativeLanguage: string;
  skill: SkillFocus;
  difficulty: number;
  answeredCount: number;
  seed: string;
  interests?: string[];
  learningGoal?: string;
  avoidItemFamilies?: string[];
}

export interface GeneratedPlacementItemPayload {
  itemKey: string;
  language: string;
  nativeLanguage: string;
  type: "multiple_choice" | "fill_blank" | "reading_comprehension" | "short_production" | "script_recognition";
  skill: SkillFocus;
  cefrLevel: CefrLevel;
  difficulty: number;
  scriptStage?: ScriptStage;
  prompt: string;
  passage?: string;
  choices: string[];
  correctAnswer?: string;
  acceptedAnswers: string[];
  productionRubric?: string;
  topics: string[];
  itemFamily: string;
  variants: [];
}

type QuizQuestionType = QuizQuestion["type"];

const CHOICE_QUESTION_TYPES = new Set<QuizQuestionType>([
  "multiple_choice",
  "fill_blank",
  "reverse_multiple_choice",
  "image_based",
  "word_to_picture",
  "picture_to_word",
  "tap_translation",
  "tap_heard_phrase",
  "choose_missing_word",
  "fill_in_context",
  "paraphrase_choice",
  "reading_comprehension",
  "media_comprehension",
  "script_recognition",
  "reading_association",
  "short_dictation",
]);
const MIN_CHOICE_OPTIONS = 4;

interface QuizBuildContext {
  level: CefrLevel;
  nativeLanguage: string;
  words: IVocabularyWord[];
  includeWordInfo: boolean;
  recentQuestionHashes: Set<string>;
  recentWordIds: Set<string>;
  usedHashes: Set<string>;
  usedWordIds: Set<string>;
  usedTypes: Map<QuizQuestionType, number>;
  /** Per-session random component so question ordering differs across sessions. */
  sessionSeed: string;
}

function normalizeWord<T extends Record<string, unknown>>(word: T): T & { id: string } {
  return {
    ...word,
    id: String(word.id ?? word._id ?? ""),
  };
}

function asVocabularyWord(word: Record<string, unknown>): IVocabularyWord {
  return normalizeWord(word) as unknown as IVocabularyWord;
}

function getRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (error instanceof AiCallError && (error.status === 429 || error.status === 403)) {
    return true;
  }
  return /quota|rate.?limit|resource_exhausted|too many requests|insufficient_quota|limit exceeded/i.test(
    message
  );
}

function isTransientAiError(error: unknown): boolean {
  if (isQuotaOrRateLimitError(error)) return true;
  if (error instanceof AiCallError) {
    return Boolean(error.transient) || Boolean(error.status && error.status >= 500);
  }
  return false;
}

function getAiClientCooldownMs(error: unknown): number | undefined {
  if (isQuotaOrRateLimitError(error)) {
    return error instanceof AiCallError && error.retryAfterMs
      ? Math.max(error.retryAfterMs, AI_TRANSIENT_COOLDOWN_MS)
      : AI_RATE_LIMIT_COOLDOWN_MS;
  }

  if (isTransientAiError(error)) {
    return AI_TRANSIENT_COOLDOWN_MS;
  }

  return undefined;
}

async function callDeepSeek(prompt: string, clientConfig: AiClientConfig): Promise<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clientConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: clientConfig.model,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AiCallError(`DeepSeek API error ${response.status}: ${errorText}`, {
      status: response.status,
      retryAfterMs: getRetryAfterMs(response.headers.get("retry-after")),
      transient: response.status >= 500,
    });
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned an empty response");
  return content;
}

async function callAi(prompt: string): Promise<string> {
  if (!isAiConfigured()) throw new Error("AI service not configured");

  let lastError = "Unknown AI error";
  const skippedClients: string[] = [];
  const now = Date.now();

  for (const clientConfig of configuredAiClients) {
    const cooldownUntil = aiClientCooldownUntil.get(clientConfig.label) ?? 0;
    if (cooldownUntil > now) {
      skippedClients.push(`${clientConfig.label} (${Math.ceil((cooldownUntil - now) / 1000)}s cooldown)`);
      continue;
    }

    try {
      return await callDeepSeek(prompt, clientConfig);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const cooldownMs = getAiClientCooldownMs(error);
      if (cooldownMs) {
        aiClientCooldownUntil.set(clientConfig.label, Date.now() + cooldownMs);
        logger.warn(
          `${clientConfig.label} temporarily disabled for ${Math.ceil(cooldownMs / 1000)}s: ${lastError}`
        );
      } else {
        logger.warn(`${clientConfig.label} failed: ${lastError}`);
      }
    }
  }

  if (lastError === "Unknown AI error" && skippedClients.length > 0) {
    throw new Error(`All AI API keys are cooling down: ${skippedClients.join("; ")}`);
  }

  throw new Error(lastError);
}

function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  return JSON.parse(candidate.trim()) as T;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cleanStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanUniqueStringArray(value: unknown, limit = 8): string[] {
  return [...new Set(cleanStringArray(value, limit * 2))].slice(0, limit);
}

function ensureOptionIncluded(options: string[], correctAnswer?: string, limit = 6): string[] {
  const cleanedCorrect = cleanText(correctAnswer);
  const values = [...options];
  if (cleanedCorrect && !values.some((item) => normalizeAnswer(item) === normalizeAnswer(cleanedCorrect))) {
    values.unshift(cleanedCorrect);
  }
  return [...new Set(values.map(cleanText).filter(Boolean))].slice(0, limit);
}

type ScriptProfile = "latin" | "cyrillic" | "han" | "kana" | "hangul" | "mixed";

function getScriptProfile(value: string): ScriptProfile | undefined {
  const text = cleanText(value);
  if (!text) return undefined;

  const checks: Array<[ScriptProfile, RegExp]> = [
    ["latin", /\p{Script=Latin}/u],
    ["cyrillic", /\p{Script=Cyrillic}/u],
    ["han", /\p{Script=Han}/u],
    ["kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
    ["hangul", /\p{Script=Hangul}/u],
  ];
  const found = checks.filter(([, pattern]) => pattern.test(text)).map(([profile]) => profile);

  if (found.length === 0) return undefined;
  return found.length === 1 ? found[0] : "mixed";
}

function hasCompatibleScript(option: string, correctAnswer: string): boolean {
  const optionProfile = getScriptProfile(option);
  const answerProfile = getScriptProfile(correctAnswer);

  if (!optionProfile || !answerProfile || answerProfile === "mixed") return true;
  return optionProfile === answerProfile;
}

function isPlaceholderAnswer(value: string): boolean {
  const normalized = normalizeAnswer(value);
  return (
    /\bmeaning$/i.test(cleanText(value)) ||
    /^a\s+(a1|a2|b1|b2|c1|c2)\s+[a-z]{2}\s+word\b/i.test(cleanText(value)) ||
    normalized === "a useful word for this lesson"
  );
}

function normalizeChoiceOptions(
  options: string[],
  correctAnswer: string,
  seed: string,
  limit = MIN_CHOICE_OPTIONS
): string[] {
  const cleanedCorrect = cleanText(correctAnswer);
  if (!cleanedCorrect || isPlaceholderAnswer(cleanedCorrect)) return [];

  const normalizedCorrect = normalizeAnswer(cleanedCorrect);
  const filtered = cleanUniqueStringArray(options, limit * 3)
    .filter((option) => {
      const normalized = normalizeAnswer(option);
      if (!normalized || isPlaceholderAnswer(option)) return false;
      if (normalized === normalizedCorrect) return true;
      if (!hasCompatibleScript(option, cleanedCorrect)) return false;
      return !hasTooSimilarSpelling(option, cleanedCorrect);
    });

  const withCorrect = ensureOptionIncluded(filtered, cleanedCorrect, limit);
  if (withCorrect.length < limit) return [];
  return shuffleValues(withCorrect.slice(0, limit), seed);
}

function coerceNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function hashText(value: string, length = 18): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isGeneratedPlaceholderText(value: unknown, word?: Pick<IVocabularyWord, "word" | "translation">): boolean {
  const text = cleanText(value);
  const targetWord = cleanText(word?.word);
  if (!text || !targetWord) return false;

  const normalizedText = normalizeAnswer(text);
  const normalizedTarget = normalizeAnswer(targetWord);
  const normalizedTranslation = normalizeAnswer(cleanText(word?.translation));
  const bannedTails = ["meaning", "translation", "definition"];
  const bannedPhrases = [
    ...bannedTails.map((tail) => `${normalizedTarget} ${tail}`),
    ...(normalizedTranslation && normalizedTranslation !== normalizedTarget
      ? [`${normalizedTarget} ${normalizedTranslation}`, `${normalizedTranslation} ${normalizedTarget}`]
      : []),
  ].filter(Boolean);

  if (bannedPhrases.includes(normalizedText)) return true;

  return bannedPhrases.some((phrase) => {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}($|\\s)`, "i");
    return pattern.test(normalizedText);
  });
}

export function cleanGeneratedExerciseText(
  value: unknown,
  word?: Pick<IVocabularyWord, "word" | "translation">
): string {
  const text = cleanText(value);
  return isGeneratedPlaceholderText(text, word) ? "" : text;
}

export function cleanGeneratedExerciseStringArray(
  value: unknown,
  word?: Pick<IVocabularyWord, "word" | "translation">,
  limit = 8
): string[] {
  return cleanUniqueStringArray(value, limit * 2)
    .filter((item) => !isGeneratedPlaceholderText(item, word))
    .slice(0, limit);
}

function getAnswerVariants(value: string, fallback?: string): string[] {
  const variants = value
    .split(/[;,/]| or /gi)
    .map((item) => normalizeAnswer(item))
    .filter(Boolean);

  if (fallback) {
    variants.push(normalizeAnswer(fallback));
  }

  return [...new Set(variants)].slice(0, 6);
}

function shuffleValues<T>(values: T[], seed: string): T[] {
  return [...values].sort((left, right) => {
    const leftHash = crypto.createHash("md5").update(`${seed}|${String(left)}`).digest("hex");
    const rightHash = crypto.createHash("md5").update(`${seed}|${String(right)}`).digest("hex");
    return leftHash.localeCompare(rightHash);
  });
}

function getFillBlankOptionCount(totalCandidates: number): number {
  return Math.max(4, Math.min(6, totalCandidates));
}

function createQuestionHash(question: {
  type: QuizQuestionType;
  wordId: string;
  question: string;
  answerSeed: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        question.type,
        question.wordId.toLowerCase(),
        question.question.toLowerCase(),
        question.answerSeed.toLowerCase(),
      ].join("|")
    )
    .digest("hex");
}

function getQuestionRecord(question: QuizQuestion): QuizQuestion & Record<string, unknown> {
  return question as QuizQuestion & Record<string, unknown>;
}

function getQuestionOptions(question: QuizQuestion): string[] {
  const options = getQuestionRecord(question).options;
  return Array.isArray(options) ? options.map((item) => cleanText(item)).filter(Boolean) : [];
}

function hasEnoughChoiceOptions(question: QuizQuestion): boolean {
  if (!CHOICE_QUESTION_TYPES.has(question.type)) return true;

  const options = getQuestionOptions(question);
  const uniqueOptions = new Set(options.map((item) => normalizeAnswer(item)).filter(Boolean));
  const correctAnswer = cleanText(getQuestionRecord(question).correctAnswer);
  const hasCorrectOption =
    !correctAnswer || [...uniqueOptions].some((item) => item === normalizeAnswer(correctAnswer));

  return uniqueOptions.size >= MIN_CHOICE_OPTIONS && hasCorrectOption;
}

function hasEnoughMatchingPairs(question: QuizQuestion): boolean {
  if (question.type !== "matching") return true;
  return question.pairs.length >= 3;
}

function getQuestionSignature(question: QuizQuestion): string {
  const record = getQuestionRecord(question);
  const contentSeed = [
    question.question,
    cleanText(record.promptText),
    cleanText(record.sentence),
    cleanText(record.passage),
    cleanText(record.prompt),
    cleanText(record.targetWord),
  ]
    .filter(Boolean)
    .join(" ");
  const answerSeed =
    cleanText(record.correctAnswer) ||
    cleanText(record.sampleAnswer) ||
    (Array.isArray(record.pairs) ? JSON.stringify(record.pairs) : "");

  return [
    question.type,
    question.wordId,
    normalizeAnswer(contentSeed),
    normalizeAnswer(answerSeed),
  ].join("|");
}

function questionRank(question: QuizQuestion, seed: string): string {
  return hashText(`${seed}|${question.questionHash}|${question.type}|${question.wordId}`, 24);
}

function getWordRepeatLimit(targetCount: number, questions: QuizQuestion[]): number {
  const realWordIds = new Set(
    questions
      .map((question) => question.wordId)
      .filter((wordId) => wordId && !wordId.startsWith("lesson:") && !wordId.startsWith("media:"))
  );
  if (realWordIds.size === 0) return targetCount;
  return Math.max(1, Math.ceil(targetCount / realWordIds.size));
}

function selectDiverseQuizQuestions(
  candidates: QuizQuestion[],
  targetCount: number,
  options: {
    recentQuestionHashes?: Iterable<string>;
    recentWordIds?: Iterable<string>;
    seed?: string;
  } = {}
): QuizQuestion[] {
  const recentHashes = new Set(options.recentQuestionHashes ?? []);
  const recentWordIds = new Set(options.recentWordIds ?? []);
  const seed = options.seed ?? "quiz";
  const selected: QuizQuestion[] = [];
  const remaining = [...candidates]
    .filter((question) => hasEnoughChoiceOptions(question))
    .filter((question) => hasEnoughMatchingPairs(question))
    .sort((left, right) => questionRank(left, seed).localeCompare(questionRank(right, seed)));
  const usedHashes = new Set<string>();
  const usedSignatures = new Set<string>();
  const wordUseCounts = new Map<string, number>();
  const typeUseCounts = new Map<QuizQuestionType, number>();
  const wordRepeatLimit = getWordRepeatLimit(targetCount, remaining);

  const phases = [
    { allowRecentWords: false, allowRecentHashes: false, allowWordOverflow: false },
    { allowRecentWords: true, allowRecentHashes: false, allowWordOverflow: false },
    { allowRecentWords: true, allowRecentHashes: true, allowWordOverflow: true },
  ];

  const canAdd = (question: QuizQuestion, phase: (typeof phases)[number]): boolean => {
    if (usedHashes.has(question.questionHash)) return false;
    if (usedSignatures.has(getQuestionSignature(question))) return false;
    if (!phase.allowRecentHashes && recentHashes.has(question.questionHash)) return false;
    if (!phase.allowRecentWords && recentWordIds.has(question.wordId)) return false;

    const wordUseCount = wordUseCounts.get(question.wordId) ?? 0;
    if (
      !phase.allowWordOverflow &&
      !question.wordId.startsWith("lesson:") &&
      !question.wordId.startsWith("media:") &&
      wordUseCount >= wordRepeatLimit
    ) {
      return false;
    }

    return true;
  };

  for (const phase of phases) {
    while (selected.length < targetCount) {
      const pool = remaining.filter((question) => canAdd(question, phase));
      if (pool.length === 0) break;

      pool.sort((left, right) => {
        const previousType = selected[selected.length - 1]?.type;
        const twoBackType = selected[selected.length - 2]?.type;
        // Score penalties: higher = worse (picked last). Consecutive same type is strongly penalized.
        const leftScore =
          (typeUseCounts.get(left.type) ?? 0) * 4 +
          (wordUseCounts.get(left.wordId) ?? 0) * 6 +
          (previousType === left.type ? 14 : 0) +   // was 5, now 14
          (twoBackType === left.type ? 5 : 0) +      // new: secondary consecutive penalty
          (recentWordIds.has(left.wordId) ? 3 : 0) +
          (recentHashes.has(left.questionHash) ? 8 : 0);
        const rightScore =
          (typeUseCounts.get(right.type) ?? 0) * 4 +
          (wordUseCounts.get(right.wordId) ?? 0) * 6 +
          (previousType === right.type ? 14 : 0) +
          (twoBackType === right.type ? 5 : 0) +
          (recentWordIds.has(right.wordId) ? 3 : 0) +
          (recentHashes.has(right.questionHash) ? 8 : 0);

        if (leftScore !== rightScore) return leftScore - rightScore;
        return questionRank(left, seed).localeCompare(questionRank(right, seed));
      });

      const next = pool[0];
      selected.push(next);
      usedHashes.add(next.questionHash);
      usedSignatures.add(getQuestionSignature(next));
      wordUseCounts.set(next.wordId, (wordUseCounts.get(next.wordId) ?? 0) + 1);
      typeUseCounts.set(next.type, (typeUseCounts.get(next.type) ?? 0) + 1);
      remaining.splice(remaining.indexOf(next), 1);
    }

    if (selected.length >= targetCount) break;
  }

  return selected.slice(0, targetCount);
}

async function requestJsonWithRetry<T>(
  promptBuilder: (attempt: number, previousError?: string) => string,
  validate: (value: unknown) => T,
  retries = 3
): Promise<T> {
  let lastError = "Unknown AI error";
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const text = await callAi(promptBuilder(attempt, lastError));
      return validate(parseJson(text));
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.warn(`AI attempt ${attempt} failed: ${lastError}`);
    }
  }
  throw new Error(lastError);
}

async function getWordForPair(wordId: string, studyLanguage: string, nativeLanguage: string) {
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const word = await VocabularyWord.findOne({
    _id: wordId,
    ...AI_SOURCE_FILTER,
    language: targetLanguage,
    nativeLanguage: sourceLanguage,
  }).lean({ virtuals: true });
  if (!word) throw new Error("Word not found for the selected language pair");
  return word;
}

function validateGeneratedWords(value: unknown): GeneratedWordPayload[] {
  if (!Array.isArray(value)) throw new Error("Expected an array of words");
  const seen = new Set<string>();
  const words: GeneratedWordPayload[] = [];

  for (const item of value) {
    const record = item as Record<string, unknown>;
    const word = cleanText(record.word);
    const translation = cleanText(record.translation);
    const definition = cleanText(record.definition);
    const exampleSentence = cleanText(record.exampleSentence);
    const easierExplanation = cleanText(record.easierExplanation);
    const topic = normalizeTopic(cleanText(record.topic), DEFAULT_TOPIC);
    const partOfSpeech = cleanText(record.partOfSpeech).toUpperCase() as PartOfSpeech;

    if (!word || !translation || !definition || !exampleSentence || !easierExplanation) continue;
    if (!PARTS_OF_SPEECH.includes(partOfSpeech)) continue;
    if (seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());

    words.push({
      word,
      translation,
      definition,
      partOfSpeech,
      topic,
      exampleSentence,
      easierExplanation,
      synonyms: cleanStringArray(record.synonyms),
      collocations: cleanStringArray(record.collocations),
      pronunciation: cleanText(record.pronunciation) || undefined,
      lessonStep: cleanText(record.lessonStep) || undefined,
      progressionStep:
        typeof record.progressionStep === "number" && Number.isFinite(record.progressionStep)
          ? Math.max(1, Math.min(10, Math.round(record.progressionStep)))
          : undefined,
    });
  }

  if (words.length === 0) throw new Error("No valid generated words");
  return words;
}

function buildWordGenerationPrompt(params: {
  level: CefrLevel;
  targetLanguageName: string;
  nativeLanguageName: string;
  topic: string;
  count: number;
  lessonStep?: string;
  progressionStep?: number;
  vocabularyHints?: string[];
}): string {
  const beginnerHints = getBeginnerTopicHints(params.level);
  const explanationLanguageName = getLanguageName(
    getExplanationLanguageCode(
      params.level,
      params.nativeLanguageName,
      params.targetLanguageName
    )
  );

  return `Vocabulary for language-learning app. Strict JSON array only.

native=${params.nativeLanguageName} | target=${params.targetLanguageName} | level=${params.level} | topic=${params.topic} | count=${params.count} | step=${params.lessonStep ?? "guided practice"} | prog=${params.progressionStep ?? 1}

Learner: ${LEVEL_DESCRIPTIONS[params.level]}
word->${params.targetLanguageName}, translation->${params.nativeLanguageName}, explanations->${explanationLanguageName}
Recommended target-language vocabulary hints: ${params.vocabularyHints?.join(", ") || "none"}
No duplicates, no off-topic, no advanced vocab.${beginnerHints.length > 0 ? ` Prioritize: ${beginnerHints.join(", ")}.` : ""}
Allowed topics: ${TOPIC_KEYS.join(", ")}.

[{"word":"","translation":"","definition":"","partOfSpeech":"NOUN","topic":"${params.topic}","exampleSentence":"","easierExplanation":"","synonyms":[],"collocations":[],"pronunciation":"","lessonStep":"${params.lessonStep ?? "guided practice"}","progressionStep":${params.progressionStep ?? 1}}]`;
}

async function saveGeneratedWords(params: GenerateWordsParams, generated: GeneratedWordPayload[]) {
  const targetLanguage = normalizeLanguageCode(params.targetLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(params.nativeLanguage, "ru");
  const explanationLanguage = getExplanationLanguageCode(params.level, sourceLanguage, targetLanguage);
  const ids: string[] = [];

  for (const item of generated) {
    const document = await VocabularyWord.findOneAndUpdate(
      {
        word: item.word,
        language: targetLanguage,
        nativeLanguage: sourceLanguage,
        cefrLevel: params.level,
        sourceType: "ai-generated",
      },
      {
        $set: {
          translation: item.translation,
          definition: item.definition,
          partOfSpeech: item.partOfSpeech,
          topic: item.topic,
          exampleSentence: item.exampleSentence,
          easierExplanation: item.easierExplanation,
          synonyms: item.synonyms,
          collocations: item.collocations,
          pronunciation: item.pronunciation ?? "",
          explanationLanguage,
          generatedBy: "deepseek",
          lessonStep: item.lessonStep ?? params.lessonStep ?? "guided practice",
          progressionStep: item.progressionStep ?? params.progressionStep ?? 1,
        },
        $setOnInsert: {
          word: item.word,
          language: targetLanguage,
          nativeLanguage: sourceLanguage,
          cefrLevel: params.level,
          sourceType: "ai-generated",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ids.push(String(document._id));
  }

  return await VocabularyWord.find({ _id: { $in: ids } }).lean({ virtuals: true }) as unknown as IVocabularyWord[];
}

async function getRecentHistory(userId: string, studyLanguage: string, nativeLanguage: string) {
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const sessions = await LearningSession.find({
    userId,
    targetLanguage,
    nativeLanguage: sourceLanguage,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("wordsAsked questionHashes")
    .lean();

  return {
    recentWordIds: new Set<string>(sessions.flatMap((session) => session.wordsAsked ?? [])),
    recentQuestionHashes: new Set<string>(sessions.flatMap((session) => session.questionHashes ?? [])),
  };
}

function getWordInfo(word: IVocabularyWord): QuizWordInfo {
  return {
    word: word.word,
    translation: word.translation,
    definition: word.definition,
    exampleSentence: word.exampleSentence,
  };
}

function buildQuestionBase(
  type: QuizQuestionType,
  word: IVocabularyWord,
  question: string,
  answerSeed: string,
  includeWordInfo: boolean
) {
  const questionHash = createQuestionHash({
    type,
    wordId: word.id,
    question,
    answerSeed,
  });

  return {
    question,
    wordId: word.id,
    questionHash,
    exerciseMeta: (() => {
      const meta = getExerciseMetadata(type);
      return {
        skill: meta.skill,
        difficulty: meta.defaultDifficulty,
        stageSuitability: meta.suitableStages,
        evaluationMode: meta.evaluationMode,
        mediaNeeds: meta.mediaNeeds,
        templateFamily: meta.templateFamily,
      };
    })(),
    ...(includeWordInfo ? { wordInfo: getWordInfo(word) } : {}),
  };
}

function groupWordsByTopic(words: IVocabularyWord[]): Array<{ topic: string; words: IVocabularyWord[] }> {
  const groups = new Map<string, IVocabularyWord[]>();

  for (const word of words) {
    const topic = normalizeTopic(cleanText(word.topic), DEFAULT_TOPIC);
    const existing = groups.get(topic) ?? [];
    existing.push(word);
    groups.set(topic, existing);
  }

  return [...groups.entries()]
    .map(([topic, topicWords]) => ({
      topic,
      words: topicWords.sort((left, right) => {
        const leftStep = left.progressionStep ?? 1;
        const rightStep = right.progressionStep ?? 1;
        if (leftStep !== rightStep) return leftStep - rightStep;
        return left.word.localeCompare(right.word);
      }),
    }))
    .sort((left, right) => {
      if (right.words.length !== left.words.length) return right.words.length - left.words.length;
      return left.topic.localeCompare(right.topic);
    });
}

function pickQuizTopicWords(words: IVocabularyWord[], preferredCount = 10): IVocabularyWord[] {
  if (words.length <= 1) return words;

  const groups = groupWordsByTopic(words);
  const primaryGroup = groups[0];
  if (!primaryGroup) return words;

  const selected = primaryGroup.words.slice(0, preferredCount);
  const selectedIds = new Set(selected.map((word) => word.id));

  for (const group of groups.slice(1)) {
    for (const word of group.words) {
      if (selected.length >= preferredCount) return selected;
      if (selectedIds.has(word.id)) continue;
      selected.push(word);
      selectedIds.add(word.id);
    }
  }

  return selected;
}

function getPrimaryTopic(words: IVocabularyWord[]): string | undefined {
  return groupWordsByTopic(words)[0]?.topic;
}

function buildRuntimeQuizMediaTask(
  _words: IVocabularyWord[],
  _studyLanguage: string,
  _level: CefrLevel
): IMediaTask | null {
  // Runtime quiz generation does not have access to verified real video clips.
  // Returning a placeholder URL would embed an unrelated video and confuse learners.
  // Media exercises are skipped when this returns null.
  return null;
}

function getQuestionTypePriority(level: CefrLevel, word: IVocabularyWord): QuizQuestionType[] {
  const base: QuizQuestionType[] = ["multiple_choice", "fill_blank", "reverse_multiple_choice"];

  if ((level === "A1" || level === "A2") && isImageFriendlyWordFromHelpers(word)) {
    base.push("image_based");
  }

  if (level === "B1") {
    base.push("translation_input");
    base.push("sentence_writing");
  }

  if (level === "B2" || level === "C1" || level === "C2") {
    base.unshift("sentence_writing");
    base.push("translation_input");
  }

  return [...new Set(base)];
}

function getRotatedQuestionTypes(level: CefrLevel, word: IVocabularyWord, usedTypes: Map<QuizQuestionType, number>) {
  const candidates = getQuestionTypePriority(level, word);
  const seed = ((word.progressionStep ?? 1) + word.word.length) % candidates.length;
  const rotated = [...candidates.slice(seed), ...candidates.slice(0, seed)];
  return rotated.sort((a, b) => (usedTypes.get(a) ?? 0) - (usedTypes.get(b) ?? 0));
}

function getDistractorValues(
  words: IVocabularyWord[],
  currentWordId: string,
  selector: (word: IVocabularyWord) => string | undefined
): string[] {
  return [...new Set(
    words
      .filter((word) => word.id !== currentWordId)
      .map(selector)
      .filter((value): value is string => Boolean(value))
      .map((value) => cleanText(value))
      .filter(Boolean)
  )];
}

function buildMultipleChoiceQuestion(word: IVocabularyWord, ctx: QuizBuildContext): MultipleChoiceQuizQuestion | null {
  const useTranslations = ctx.level === "A1" || ctx.level === "A2" || ctx.level === "B1";
  const correctAnswer = cleanText(useTranslations ? word.translation : word.definition);
  const distractors = getDistractorValues(
    ctx.words,
    word.id,
    (candidate) => (useTranslations ? candidate.translation : candidate.definition)
  ).filter((value) => {
    const n = normalizeAnswer(value);
    const correct = normalizeAnswer(correctAnswer);
    if (!n || n === correct) return false;
    // Prefer same-POS distractors; also remove distractors too similar in spelling
    if (hasTooSimilarSpelling(value, correctAnswer)) return false;
    return true;
  });

  const options = normalizeChoiceOptions(
    [correctAnswer, ...distractors],
    correctAnswer,
    `${word.id}|multiple_choice`
  );
  if (options.length < 4) return null;

  const question = useTranslations
    ? getLocalInstruction("choose_meaning", ctx.nativeLanguage, word.word)
    : getLocalInstruction("read_and_choose_meaning", ctx.nativeLanguage, word.word);

  return {
    type: "multiple_choice",
    ...buildQuestionBase("multiple_choice", word, question, correctAnswer, ctx.includeWordInfo),
    options,
    correctAnswer,
  };
}

function buildFillBlankQuestion(word: IVocabularyWord, ctx: QuizBuildContext): FillBlankQuizQuestion | null {
  const sourceSentence = cleanText(word.exampleSentence);
  if (!sourceSentence) return null;

  const pattern = new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!pattern.test(sourceSentence)) return null;

  const sentence = sourceSentence.replace(pattern, "_____");
  const question = getLocalInstruction("complete_sentence", ctx.nativeLanguage);
  const distractors = getDistractorValues(ctx.words, word.id, (candidate) => candidate.word).filter(
    (value) => normalizeAnswer(value) !== normalizeAnswer(word.word)
  );
  const optionCount = getFillBlankOptionCount(1 + distractors.length);
  const options = normalizeChoiceOptions(
    [word.word, ...distractors],
    word.word,
    `${word.id}|fill_blank`,
    optionCount
  );

  if (options.length < 4) return null;

  return {
    type: "fill_blank",
    ...buildQuestionBase("fill_blank", word, question, word.word, ctx.includeWordInfo),
    sentence,
    options,
    correctAnswer: word.word,
    acceptedAnswers: getAnswerVariants(word.word),
  };
}

function buildTranslationInputQuestion(
  word: IVocabularyWord,
  ctx: QuizBuildContext
): TranslationInputQuizQuestion | null {
  if (ctx.level === "A1") return null;

  const question = getLocalInstruction("choose_translation", ctx.nativeLanguage, word.word);

  return {
    type: "translation_input",
    ...buildQuestionBase("translation_input", word, question, word.translation, ctx.includeWordInfo),
    promptWord: word.word,
    correctAnswer: cleanText(word.translation),
    acceptedAnswers: getAnswerVariants(word.translation, word.translation),
  };
}

function buildReverseMultipleChoiceQuestion(
  word: IVocabularyWord,
  ctx: QuizBuildContext
): ReverseMultipleChoiceQuizQuestion | null {
  const promptTranslation = cleanText(word.translation);
  if (!promptTranslation) return null;

  const distractors = getDistractorValues(ctx.words, word.id, (candidate) => candidate.word).filter(
    (value) => {
      const n = normalizeAnswer(value);
      if (!n || n === normalizeAnswer(word.word)) return false;
      if (hasTooSimilarSpelling(value, word.word)) return false;
      return true;
    }
  );
  const options = normalizeChoiceOptions(
    [word.word, ...distractors],
    word.word,
    `${word.id}|reverse_multiple_choice`
  );

  if (options.length < 4) return null;

  return {
    type: "reverse_multiple_choice",
    ...buildQuestionBase("reverse_multiple_choice", word, getLocalInstruction("which_word_matches", ctx.nativeLanguage, promptTranslation), word.word, ctx.includeWordInfo),
    promptTranslation,
    options,
    correctAnswer: word.word,
  };
}

function getSentenceWritingMinWords(level: CefrLevel) {
  return level === "B1" ? 5 : 7;
}

function getSentenceWritingKeywordHints(word: IVocabularyWord | undefined) {
  if (!word) return [];

  const keywordHints = [word.topic, word.collocations[0]]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .filter((item) => !isGeneratedPlaceholderText(item, word))
    .slice(0, 3);

  return keywordHints;
}

function getSentenceWritingInstructions(targetWord: string, minWords: number) {
  return [
    `Write in the language you are studying.`,
    `Use "${targetWord}" naturally in your sentence.`,
    `Write at least ${minWords} words.`,
  ];
}

function getSentenceWritingHelpfulTips(word: IVocabularyWord | undefined) {
  if (!word) return ["Keep the sentence concrete and natural."];

  const helpfulTips = [
    word.collocations[0] ? `Try this phrase: ${cleanText(word.collocations[0])}` : "",
    word.exampleSentence ? `Keep it similar in difficulty to the example.` : "",
  ]
    .filter(Boolean)
    .filter((item) => !isGeneratedPlaceholderText(item, word));

  return helpfulTips.length ? helpfulTips : ["Keep the sentence concrete and natural."];
}

export function buildSentenceWritingSupport(params: {
  level: CefrLevel;
  targetWord: string;
  word?: IVocabularyWord;
  minWords?: unknown;
  instructions?: unknown;
  helpfulTips?: unknown;
  keywordHints?: unknown;
}) {
  const targetWord = cleanText(params.targetWord);
  const minWords = coerceNumber(params.minWords, getSentenceWritingMinWords(params.level), 3, 80);
  const keywordHints = cleanGeneratedExerciseStringArray(params.keywordHints, params.word, 6);
  const instructions = cleanGeneratedExerciseStringArray(params.instructions, params.word, 5);
  const helpfulTips = cleanGeneratedExerciseStringArray(params.helpfulTips, params.word, 5);

  return {
    minWords,
    keywordHints: keywordHints.length ? keywordHints : getSentenceWritingKeywordHints(params.word),
    instructions: instructions.length ? instructions : getSentenceWritingInstructions(targetWord, minWords),
    helpfulTips: helpfulTips.length ? helpfulTips : getSentenceWritingHelpfulTips(params.word),
  };
}

function buildSentenceWritingQuestion(
  word: IVocabularyWord,
  ctx: QuizBuildContext
): SentenceWritingQuizQuestion | null {
  if (ctx.level === "A1" || ctx.level === "A2") return null;

  const question = getSentenceWritingPrompt(ctx.nativeLanguage, word.word);
  const support = buildSentenceWritingSupport({
    level: ctx.level,
    targetWord: word.word,
    word,
  });

  return {
    type: "sentence_writing",
    ...buildQuestionBase("sentence_writing", word, question, word.word, ctx.includeWordInfo),
    targetWord: word.word,
    minWords: support.minWords,
    keywordHints: support.keywordHints,
    instructions: support.instructions,
    helpfulTips: support.helpfulTips,
    sampleAnswer: word.exampleSentence,
  };
}

function buildImageBasedQuestion(word: IVocabularyWord, ctx: QuizBuildContext): ImageBasedQuizQuestion | null {
  const imageUrl = buildImageUrlFromHelpers(word);
  if (!imageUrl) return null;

  const topicDistractors = ctx.words
    .filter((candidate) => candidate.id !== word.id)
    .filter((candidate) => candidate.topic === word.topic || candidate.partOfSpeech === word.partOfSpeech)
    .map((candidate) => cleanText(candidate.word))
    .filter(Boolean);
  const fallbackDistractors = getDistractorValues(ctx.words, word.id, (candidate) => candidate.word);
  const options = normalizeChoiceOptions([
    word.word,
    ...topicDistractors,
    ...fallbackDistractors,
  ], word.word, `${word.id}|image_based`);

  if (options.length < MIN_CHOICE_OPTIONS) return null;

  const question = getLocalInstruction("choose_word_for_image", ctx.nativeLanguage);

  return {
    type: "image_based",
    ...buildQuestionBase("image_based", word, question, word.word, ctx.includeWordInfo),
    imageUrl,
    correctAnswer: word.word,
    acceptedAnswers: getAnswerVariants(word.word),
    options,
  };
}

function buildQuestionForType(
  type: QuizQuestionType,
  word: IVocabularyWord,
  ctx: QuizBuildContext
): QuizQuestion | null {
  switch (type) {
    case "multiple_choice":
      return buildMultipleChoiceQuestion(word, ctx);
    case "fill_blank":
      return buildFillBlankQuestion(word, ctx);
    case "translation_input":
      return buildTranslationInputQuestion(word, ctx);
    case "reverse_multiple_choice":
      return buildReverseMultipleChoiceQuestion(word, ctx);
    case "sentence_writing":
      return buildSentenceWritingQuestion(word, ctx);
    case "image_based":
      return buildImageBasedQuestion(word, ctx);
    default:
      return null;
  }
}

function markQuestionUsed(question: QuizQuestion, ctx: QuizBuildContext) {
  ctx.usedHashes.add(question.questionHash);
  ctx.usedWordIds.add(question.wordId);
  ctx.usedTypes.set(question.type, (ctx.usedTypes.get(question.type) ?? 0) + 1);
}

function buildQuizQuestions(words: IVocabularyWord[], ctx: QuizBuildContext): QuizQuestion[] {
  const candidates: QuizQuestion[] = [];
  for (const word of words) {
    const types = getRotatedQuestionTypes(ctx.level, word, ctx.usedTypes);
    for (const type of types) {
      const question = buildQuestionForType(type, word, ctx);
      if (question) candidates.push(question);
    }
  }

  const selected = selectDiverseQuizQuestions(candidates, QUESTION_TARGET_COUNT, {
    recentQuestionHashes: ctx.recentQuestionHashes,
    recentWordIds: ctx.recentWordIds,
    seed: `${ctx.level}|${words.map((word) => word.id).join("|")}|${ctx.sessionSeed}`,
  });

  for (const question of selected) {
    markQuestionUsed(question, ctx);
  }

  return selected;
}

async function generateQuizFromWords(params: {
  userId: string;
  level: CefrLevel;
  studyLanguage: string;
  nativeLanguage: string;
  words: IVocabularyWord[];
  includeWordInfo?: boolean;
}): Promise<QuizQuestion[]> {
  const { recentWordIds, recentQuestionHashes } = await getRecentHistory(
    params.userId,
    params.studyLanguage,
    params.nativeLanguage
  );

  const topicWords = pickQuizTopicWords(params.words, 10);
  if (topicWords.length === 0) return [];

  // Always build local questions first — fast, no AI cost.
  const localCtx: QuizBuildContext = {
    level: params.level,
    nativeLanguage: params.nativeLanguage,
    words: topicWords,
    includeWordInfo: params.includeWordInfo ?? false,
    recentQuestionHashes,
    recentWordIds,
    usedHashes: new Set<string>(),
    usedWordIds: new Set<string>(),
    usedTypes: new Map<QuizQuestionType, number>(),
    sessionSeed: crypto.randomBytes(8).toString("hex"),
  };
  const localQuestions = buildQuizQuestions(topicWords, localCtx);

  // For early-stage learners, skip AI entirely when local coverage is sufficient.
  const isEarlyStage = params.level === "A1" || params.level === "A2";
  if (isEarlyStage && localQuestions.length >= QUESTION_TARGET_COUNT) {
    logger.info(`generateQuizFromWords: early-stage fast path — ${localQuestions.length} local questions for ${params.level}`);
    return localQuestions.slice(0, QUESTION_TARGET_COUNT);
  }

  // No AI configured — use local questions or fail if insufficient.
  if (!isAiConfigured()) {
    if (localQuestions.length >= Math.ceil(QUESTION_TARGET_COUNT * 0.6)) {
      logger.info(`generateQuizFromWords: AI not configured, using ${localQuestions.length} local questions`);
      return localQuestions.slice(0, QUESTION_TARGET_COUNT);
    }
    throw new Error("AI service not configured and local exercises are insufficient");
  }

  const user = {
    _id: params.userId,
    id: params.userId,
    currentLevel: params.level,
    studyLanguage: params.studyLanguage,
    nativeLanguage: params.nativeLanguage,
    learnerStage: getFallbackLearnerStage(params.level),
    scriptStage: getFallbackScriptStage(params.studyLanguage),
    interests: [getPrimaryTopic(topicWords)].filter(Boolean),
  } as unknown as IUser;
  const node = {
    _id: `ai-quiz:${params.userId}:${params.level}`,
    title: "AI vocabulary practice",
    objective: "Practice selected vocabulary with fresh AI-authored exercises.",
    grammarTargets: [],
    interestTags: [getPrimaryTopic(topicWords) ?? "daily life"],
    scriptFocus: getFallbackScriptStage(params.studyLanguage),
  } as unknown as ICurriculumNode;
  const exerciseParams: RoadmapExerciseGenerationParams = {
    user,
    node,
    words: topicWords,
    mode: "lesson",
    exerciseTypes: getGenericAiQuizExerciseTypes(params.level),
    media: buildRuntimeQuizMediaTask(topicWords, params.studyLanguage, params.level),
    recentQuestionHashes: [...recentQuestionHashes],
    recentWordIds: [...recentWordIds],
    count: QUESTION_TARGET_COUNT,
  };

  try {
    return await requestJsonWithRetry(
      (attempt, previousError) =>
        `${buildCompactExercisePrompt(exerciseParams)}\n\n${
          attempt > 1 ? `Previous attempt failed: ${previousError}. Return valid strict JSON only.` : ""
        }`,
      (value) => validateRoadmapExercises(value, exerciseParams)
    );
  } catch (error) {
    // AI failed — fall back to local questions if sufficient.
    if (localQuestions.length >= Math.ceil(QUESTION_TARGET_COUNT * 0.6)) {
      logger.warn(`generateQuizFromWords: AI failed, falling back to ${localQuestions.length} local questions: ${error}`);
      return localQuestions.slice(0, QUESTION_TARGET_COUNT);
    }
    throw error;
  }
}

function getFallbackLearnerStage(level: CefrLevel) {
  if (level === "A1") return "early_beginner";
  if (level === "A2") return "late_beginner";
  if (level === "B1") return "intermediate";
  if (level === "B2") return "upper_intermediate";
  return "advanced";
}

function getFallbackScriptStage(language: string): ScriptStage {
  const normalized = normalizeLanguageCode(language, "en");
  if (normalized === "ja") return "kana_intro";
  if (["zh", "ko"].includes(normalized)) return "native_script";
  return "latin";
}

function getGenericAiQuizExerciseTypes(level: CefrLevel): ExerciseType[] {
  const shared: ExerciseType[] = [
    "multiple_choice",
    "fill_blank",
    "reverse_multiple_choice",
    "translation_input",
    "image_based",
    "word_to_picture",
    "picture_to_word",
    "tap_translation",
    "choose_missing_word",
    "reorder_words",
    "matching",
    "reading_comprehension",
  ];

  if (level === "A1" || level === "A2") {
    return [
      ...shared,
      ...(level === "A2" ? (["transcript_gap_fill", "media_transcript"] as ExerciseType[]) : []),
      "sentence_writing",
    ];
  }

  return [
    ...shared,
    "fill_in_context",
    "paraphrase_choice",
    "transcript_gap_fill",
    "media_transcript",
    "media_comprehension",
    "translation_variants",
    "sentence_writing",
    "open_translation",
    "short_paragraph_response",
    "summary",
  ];
}

export function toPublicQuizQuestion(question: QuizQuestion): PublicQuizQuestion {
  const {
    acceptedAnswers: _acceptedAnswers,
    sampleAnswer: _sampleAnswer,
    ...publicQuestion
  } = question as QuizQuestion & {
    acceptedAnswers?: string[];
    sampleAnswer?: string;
  };

  const word = publicQuestion.wordInfo
    ? {
        word: publicQuestion.wordInfo.word,
        translation: publicQuestion.wordInfo.translation,
      }
    : undefined;

  const sanitized = sanitizeGeneratedPlaceholders(publicQuestion, word) as PublicQuizQuestion;
  return {
    ...sanitized,
    question: cleanText(sanitized.question) || getExerciseMetadata(sanitized.type).label,
  } as PublicQuizQuestion;
}

function sanitizeGeneratedPlaceholders(
  value: unknown,
  word?: Pick<IVocabularyWord, "word" | "translation">
): unknown {
  if (typeof value === "string") return cleanGeneratedExerciseText(value, word);
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeGeneratedPlaceholders(item, word))
      .filter((item) => !(typeof item === "string" && !item));
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => key !== "imageUrl" || !isDisallowedPlaceholderImageUrl(item))
      .map(([key, item]) => [
        key,
        sanitizeGeneratedPlaceholders(item, word),
      ])
  );
}

function statusFromCorrect(correct: boolean): QuizEvaluationStatus {
  return correct ? "correct" : "incorrect";
}

function validateQuizAnswerEvaluation(value: unknown, questionType: QuizQuestionType): QuizAnswerEvaluation {
  const record = value as Record<string, unknown>;
  const correct = Boolean(record.correct);
  const rawStatus = cleanText(record.status);
  const feedback = cleanText(record.feedback);
  const correctAnswer = cleanText(record.correctAnswer) || undefined;
  const acceptedEquivalent = cleanText(record.acceptedEquivalent) || undefined;
  const correctedAnswer = cleanText(record.correctedAnswer) || undefined;
  const hasMistakes =
    typeof record.hasMistakes === "boolean" ? record.hasMistakes : !correct;
  const ruleChecks = Array.isArray(record.ruleChecks)
    ? record.ruleChecks
        .map((item) => {
          const rule = item as Record<string, unknown>;
          const label = cleanText(rule.label);
          const detail = cleanText(rule.detail);
          if (!label || !detail) return null;
          return {
            label,
            passed: Boolean(rule.passed),
            detail,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .slice(0, 6)
    : undefined;

  if (!feedback) {
    throw new Error("Missing feedback in AI evaluation");
  }

  return {
    questionType,
    status:
      rawStatus === "correct" || rawStatus === "incorrect" || rawStatus === "pending_review"
        ? rawStatus
        : statusFromCorrect(correct),
    correct,
    feedback,
    correctAnswer,
    acceptedEquivalent,
    hasMistakes,
    correctedAnswer,
    ruleChecks,
  };
}

function buildExactMatchEvaluation(params: {
  questionType: QuizQuestionType;
  answer: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
  correctFeedback: string;
  incorrectFeedback: string;
}): QuizAnswerEvaluation {
  const acceptedAnswers =
    params.acceptedAnswers && params.acceptedAnswers.length > 0
      ? params.acceptedAnswers
      : [params.correctAnswer];
  const correct = acceptedAnswers.some(
    (item) => normalizeAnswer(item) === normalizeAnswer(params.answer)
  );

  return {
    questionType: params.questionType,
    status: statusFromCorrect(correct),
    correct,
    feedback: correct ? params.correctFeedback : params.incorrectFeedback,
    correctAnswer: cleanText(params.correctAnswer),
    hasMistakes: !correct,
  };
}

function buildSentenceFallbackEvaluation(params: {
  targetWord: string;
  answer: string;
  minWords: number;
  sampleAnswer?: string;
}): QuizAnswerEvaluation {
  const wordCount = normalizeAnswer(params.answer).split(" ").filter(Boolean).length;
  const usesTargetWord = normalizeAnswer(params.answer).includes(normalizeAnswer(params.targetWord));
  const meetsMinWords = wordCount >= params.minWords;

  return {
    questionType: "sentence_writing",
    status: "pending_review",
    correct: false,
    feedback:
      "Your answer was received. Automatic review is temporarily unavailable, so this response will not reduce your progress.",
    hasMistakes: false,
    correctedAnswer: params.sampleAnswer,
    ruleChecks: [
      {
        label: "Use the target word",
        passed: usesTargetWord,
        detail: usesTargetWord
          ? `The sentence uses "${params.targetWord}".`
          : `Add "${params.targetWord}" to the sentence.`,
      },
      {
        label: "Minimum length",
        passed: meetsMinWords,
        detail: meetsMinWords
          ? `The sentence has at least ${params.minWords} words.`
          : `Write at least ${params.minWords} words.`,
      },
    ],
  };
}

function getLevenshteinDistance(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));

  for (let row = 0; row <= left.length; row += 1) matrix[row][0] = row;
  for (let col = 0; col <= right.length; col += 1) matrix[0][col] = col;

  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

// Detects distractors that would be trivially wrong because they look too similar to the answer.
// Single-char edits on short words create confusing near-duplicates, not meaningful distractors.
function hasTooSimilarSpelling(candidate: string, target: string): boolean {
  const a = normalizeAnswer(candidate);
  const b = normalizeAnswer(target);
  if (!a || !b || a === b) return true; // identical after normalization
  // Only applies to single words (no spaces) — multi-word translations can overlap in structure
  if (a.includes(" ") || b.includes(" ")) return false;
  if (a.length < 4 || b.length < 4) return false;
  const dist = getLevenshteinDistance(a, b);
  const shorter = Math.min(a.length, b.length);
  // 1-char edit on any length, or 2-char edit on a short word, is too close
  return dist === 1 || (dist === 2 && shorter <= 5);
}

function isCloseInflectionVariant(expected: string, actual: string): boolean {
  const normalizedExpected = normalizeAnswer(expected);
  const normalizedActual = normalizeAnswer(actual);

  if (!normalizedExpected || !normalizedActual) return false;
  if (normalizedExpected === normalizedActual) return true;
  if (normalizedExpected.includes(" ") || normalizedActual.includes(" ")) return false;
  if (normalizedExpected.length < 6 || normalizedActual.length < 6) return false;

  const sharedPrefixLength = Math.min(7, normalizedExpected.length, normalizedActual.length);
  if (normalizedExpected.slice(0, sharedPrefixLength) !== normalizedActual.slice(0, sharedPrefixLength)) {
    return false;
  }

  return getLevenshteinDistance(normalizedExpected, normalizedActual) <= 2;
}

async function evaluateTranslationAnswer(params: {
  level: CefrLevel;
  answer: string;
  word: IVocabularyWord;
  targetLanguage: string;
  nativeLanguage: string;
}): Promise<QuizAnswerEvaluation> {
  const directMatch = getAnswerVariants(params.word.translation, params.word.translation).some(
    (item) => normalizeAnswer(item) === normalizeAnswer(params.answer)
  );
  const closeInflectionMatch = getAnswerVariants(params.word.translation, params.word.translation).some(
    (item) => isCloseInflectionVariant(item, params.answer)
  );

  if (directMatch || closeInflectionMatch) {
    return {
      questionType: "translation_input",
      status: "correct",
      correct: true,
      feedback: "This translation matches the expected meaning.",
      correctAnswer: cleanText(params.word.translation),
      acceptedEquivalent: cleanText(params.answer),
      hasMistakes: false,
    };
  }

  if (!isAiConfigured()) {
    return {
      questionType: "translation_input",
      status: "pending_review",
      correct: false,
      feedback:
        "Your answer was received. Automatic review is temporarily unavailable, so this translation will not reduce your progress.",
      correctAnswer: cleanText(params.word.translation),
      hasMistakes: false,
    };
  }

  const explanationLanguage = getExplanationLanguageCode(
    params.level,
    params.nativeLanguage,
    params.targetLanguage
  );

  return requestJsonWithRetry(
    () => `You evaluate vocabulary translations. Strict JSON only.

Explain feedback in ${getLanguageName(explanationLanguage)}.
Study language: ${getLanguageName(params.targetLanguage)}.
Native language: ${getLanguageName(params.nativeLanguage)}.
Word in study language: "${params.word.word}".
Saved translation in native language: "${params.word.translation}".
Definition: "${params.word.definition}".
User answer in native language: "${cleanText(params.answer)}".

Rules:
- Mark correct=true if the user's translation is a natural and accurate equivalent in the native language, even if it uses different wording.
- Accept close synonyms, common variants, singular/plural differences, case or inflection changes, articles omitted, and equivalent short phrases.
- Example: if the meaning matches, a singular saved translation can still accept a plural user answer such as consequence -> последствия.
- Mark correct=false if the meaning is different, too broad, too narrow, or in the wrong language.
- Keep feedback short and practical.

{"correct":true,"feedback":"","correctAnswer":"${cleanText(params.word.translation)}","acceptedEquivalent":"","hasMistakes":false}`,
    (value) => validateQuizAnswerEvaluation(value, "translation_input")
  );
}

async function evaluateSentenceAnswer(params: {
  level: CefrLevel;
  answer: string;
  targetWord: string;
  minWords: number;
  word: IVocabularyWord;
  targetLanguage: string;
  nativeLanguage: string;
}): Promise<QuizAnswerEvaluation> {
  const fallback = buildSentenceFallbackEvaluation({
    targetWord: params.targetWord,
    answer: params.answer,
    minWords: params.minWords,
    sampleAnswer: params.word.exampleSentence,
  });

  if (!isAiConfigured()) {
    return fallback;
  }

  const explanationLanguage = getExplanationLanguageCode(
    params.level,
    params.nativeLanguage,
    params.targetLanguage
  );

  try {
    return await requestJsonWithRetry(
      () => `You evaluate short learner sentences. Strict JSON only.

Explain feedback in ${getLanguageName(explanationLanguage)}.
Sentence language: ${getLanguageName(params.targetLanguage)}.
Learner native language: ${getLanguageName(params.nativeLanguage)}.
Target vocabulary word: "${params.targetWord}".
Expected meaning: "${params.word.translation}".
Definition: "${params.word.definition}".
Minimum words: ${params.minWords}.
User sentence: "${cleanText(params.answer)}".

Rules:
- Accept inflected or conjugated forms of the target word if they clearly use the same lemma naturally.
- Check whether the sentence is understandable, grammatical enough for the learner level, and matches the target word meaning.
- Mark correct=true when the sentence follows the core rules and only has very minor issues.
- Mark hasMistakes=true when there are grammar, word-choice, or sentence-formation problems the learner should notice.
- Give brief actionable feedback.
- Return up to 4 rule checks.

{"correct":true,"feedback":"","correctAnswer":"",   "acceptedEquivalent":"","hasMistakes":false,"correctedAnswer":"","ruleChecks":[{"label":"","passed":true,"detail":""}]}`,
      (value) => validateQuizAnswerEvaluation(value, "sentence_writing")
    );
  } catch (error) {
    logger.warn(`AI sentence evaluation failed: ${error}`);
    return fallback;
  }
}

export async function explainWord(
  wordId: string,
  level: CefrLevel,
  studyLanguage: string,
  nativeLanguage: string
): Promise<{ simpleExplanation: string; tips: string[]; explanationLanguage: string }> {
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const pairKey = buildLanguagePairKey(targetLanguage, sourceLanguage);
  const explanationLanguage = getExplanationLanguageCode(level, sourceLanguage, targetLanguage);
  const word = await getWordForPair(wordId, targetLanguage, sourceLanguage);

  const cached = await AIContentCache.findOne({
    wordId,
    cefrLevel: level,
    contentType: "explanation",
    nativeLanguage: `${pairKey}:${explanationLanguage}`,
  });
  if (cached && cached.expiresAt > new Date()) {
    return cached.content as { simpleExplanation: string; tips: string[]; explanationLanguage: string };
  }

  const fallback = {
    simpleExplanation: word.easierExplanation || word.translation || word.definition,
    tips: [`Part of speech: ${String(word.partOfSpeech).toLowerCase()}`, `Level: ${word.cefrLevel}`],
    explanationLanguage,
  };

  if (!isAiConfigured()) return fallback;

  try {
    const result = await requestJsonWithRetry(
      () => `Language tutor. Strict JSON only.

native=${getLanguageName(sourceLanguage)} | target=${getLanguageName(targetLanguage)} | level=${level}
word=${word.word} | translation=${word.translation} | definition=${word.definition}
Explain in ${getLanguageName(explanationLanguage)}, short, level-appropriate.

{"simpleExplanation":"","tips":["",""]}`,
      (value) => {
        const record = value as Record<string, unknown>;
        const simpleExplanation = cleanText(record.simpleExplanation);
        const tips = cleanStringArray(record.tips, 4);
        if (!simpleExplanation) throw new Error("Missing simpleExplanation");
        return { simpleExplanation, tips, explanationLanguage };
      }
    );

    await AIContentCache.findOneAndUpdate(
      { wordId, cefrLevel: level, contentType: "explanation", nativeLanguage: `${pairKey}:${explanationLanguage}` },
      { $set: { content: result, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
      { upsert: true }
    );

    return result;
  } catch (error) {
    logger.warn(`AI explain failed: ${error}`);
    return fallback;
  }
}

export async function generateExamples(
  wordId: string,
  level: CefrLevel,
  studyLanguage: string,
  nativeLanguage: string
): Promise<{ sentences: string[] }> {
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const pairKey = buildLanguagePairKey(targetLanguage, sourceLanguage);
  const word = await getWordForPair(wordId, targetLanguage, sourceLanguage);

  const cached = await AIContentCache.findOne({
    wordId,
    cefrLevel: level,
    contentType: "examples",
    nativeLanguage: pairKey,
  });
  if (cached && cached.expiresAt > new Date()) {
    return cached.content as { sentences: string[] };
  }

  const fallback = { sentences: [word.exampleSentence] };
  if (!isAiConfigured()) return fallback;

  try {
    const result = await requestJsonWithRetry(
      () => `3 example sentences. Strict JSON only.

target=${getLanguageName(targetLanguage)} | level=${level} | word="${word.word}"
Sentences in ${getLanguageName(targetLanguage)}, level-appropriate (${LEVEL_DESCRIPTIONS[level]}).

{"sentences":["","",""]}`,
      (value) => {
        const record = value as Record<string, unknown>;
        const sentences = cleanStringArray(record.sentences, 3);
        if (sentences.length === 0) throw new Error("No valid sentences");
        return { sentences };
      }
    );

    await AIContentCache.findOneAndUpdate(
      { wordId, cefrLevel: level, contentType: "examples", nativeLanguage: pairKey },
      { $set: { content: result, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
      { upsert: true }
    );

    return result;
  } catch (error) {
    logger.warn(`AI examples failed: ${error}`);
    return fallback;
  }
}

export async function generateAndSaveWords(params: GenerateWordsParams): Promise<IVocabularyWord[]> {
  if (!isAiConfigured()) throw new Error("AI service not configured");

  const targetLanguage = normalizeLanguageCode(params.targetLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(params.nativeLanguage, "ru");
  const count = Math.min(params.count ?? 20, 30);
  const topic = normalizeTopic(params.topic, params.level === "A1" ? "greetings" : DEFAULT_TOPIC);

  const generated = await requestJsonWithRetry(
    (attempt, previousError) => `${buildWordGenerationPrompt({
      level: params.level,
      targetLanguageName: getLanguageName(targetLanguage),
      nativeLanguageName: getLanguageName(sourceLanguage),
      topic,
          count,
          lessonStep: params.lessonStep,
          progressionStep: params.progressionStep,
          vocabularyHints: params.vocabularyHints,
        })}\n\n${attempt > 1 ? `Previous attempt failed: ${previousError}. Return valid strict JSON only.` : ""}`,
    validateGeneratedWords
  );

  const words = await saveGeneratedWords(
    {
      ...params,
      targetLanguage,
      nativeLanguage: sourceLanguage,
      topic,
      count,
    },
    generated
  );

  logger.info(`Generated ${words.length} words for ${sourceLanguage}->${targetLanguage} at ${params.level}/${topic}`);
  return words.map((word) => asVocabularyWord(word as unknown as Record<string, unknown>));
}

function buildExercisePrompt(params: RoadmapExerciseGenerationParams) {
  const targetLanguage = normalizeLanguageCode(params.user.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(params.user.nativeLanguage, "ru");
  const count = Math.max(10, params.count ?? (params.mode === "challenge" ? 12 : 10));
  const wordLines = params.words
    .slice(0, 16)
    .map((word) =>
      [
        `id=${word.id}`,
        `word=${word.word}`,
        `translation=${word.translation}`,
        `definition=${word.definition}`,
        `example=${word.exampleSentence}`,
        `topic=${word.topic ?? "daily life"}`,
        `pronunciation=${word.pronunciation ?? ""}`,
        `synonyms=${word.synonyms?.join(", ") ?? ""}`,
      ].join(" | ")
    )
    .join("\n");
  const mediaLine = params.media
    ? [
        `title=${params.media.clipTitle}`,
        `url=${params.media.sourceUrl}`,
        `transcript=${params.media.transcriptSegment}`,
        `seconds=${params.media.startSeconds}-${params.media.endSeconds}`,
      ].join(" | ")
    : "none";
  const recentWordLine = params.recentWordIds?.length
    ? params.recentWordIds.slice(0, 24).join(", ")
    : "none";

  return `Generate live lesson exercises for AsaLingo. Strict JSON array only.

Target language: ${getLanguageName(targetLanguage)} (${targetLanguage})
Native language: ${getLanguageName(nativeLanguage)} (${nativeLanguage})
Level: ${params.user.currentLevel}
Learner stage: ${params.user.learnerStage}
Script stage: ${params.user.scriptStage}
Mode: ${params.mode}
Roadmap node: ${params.node.title}
Objective: ${params.node.objective}
Grammar targets: ${params.node.grammarTargets.join(", ") || "none"}
Interests: ${params.user.interests?.join(", ") || params.node.interestTags.join(", ") || "daily life"}
Exercise types to use, in order: ${params.exerciseTypes.join(", ")}
Generate exactly ${count} items. Use only the word ids listed below, except open writing may use wordId="lesson:${params.node._id}".
Recently used word ids to avoid unless necessary: ${recentWordLine}

Words:
${wordLines}

Media clip: ${mediaLine}

Rules:
- Every item must be freshly authored from the context above — never reproduce a memorised test question.
- Write learner-facing instructions/questions in ${getLanguageName(nativeLanguage)} when they explain what to do.
- Put target-language sentences, passages, answer options, dictation text, and production prompts in ${getLanguageName(targetLanguage)} when testing comprehension or production.
- Include native-language translations/explanations when that helps the learner understand the task, especially through B1.
- Respect the learner stage and script stage. For Japanese romaji/kana stages, avoid unsupported kanji.
- LANGUAGE CONSISTENCY: Do not mix answer-option languages in one item. If the correct answer is in ${getLanguageName(nativeLanguage)}, every distractor must also be in ${getLanguageName(nativeLanguage)}. If the correct answer is in ${getLanguageName(targetLanguage)}, every distractor must also be in ${getLanguageName(targetLanguage)}.
- VARIETY: Use at least ${Math.min(6, params.exerciseTypes.length)} different exercise types. NEVER place the same type twice in a row — interleave different types throughout the set.
- WORD COVERAGE: Do not repeat the same wordId more than twice. Aim for at least ${Math.min(8, params.words.length)} different word ids.
- STEM DIVERSITY: Do not reuse the same question stem with only the word swapped. Use example sentences, collocations, the roadmap objective, or real scenario context to differentiate each item.
- CHOICE QUALITY: Include exactly 4 options. Distractors must be from the same semantic domain and part of speech as the correct answer. Never pick distractors that differ by only one or two characters in spelling.
- AVOID BANAL ITEMS: Do not ask generic textbook prompts like "What does X mean?" unless the learner is A1 and the item is intentionally simple. Prefer short realistic situations, mini-dialogues, concrete goals, or cause/effect context.
- PARAPHRASE: For paraphrase_choice, write a short 2–3 sentence context passage (NOT just the example sentence) where the target word appears naturally. Ask what the word means in that specific passage. Options must differ in meaning, register, or nuance — not just in wording.
- READING COMPREHENSION: For reading_comprehension, write a dedicated micro-passage (3–5 sentences) that includes the target word in a realistic scenario. Ask a comprehension question about the passage.
- FILL BLANK: For fill_blank and choose_missing_word, use the example sentence with the target word blanked. Distractors must be same part of speech and plausible in the sentence.
- EXACT MATCH: For typed/exact tasks, include correctAnswer and acceptedAnswers.
- REORDER: For reorder_words, tokens must be a shuffled version of the correctAnswer words; correctAnswer must be the full sentence.
- MATCHING: For matching, include 3–4 pairs; options must be the shuffled set of right-side values.
- WRITING: For writing tasks, include prompt, minWords, rubric (3–5 rules), and sampleAnswer. For sentence_writing, include non-empty keywordHints, instructions, and helpfulTips.
- QUALITY GATE: If you cannot produce a strong distractor or context for a word, skip that word and use a different one. Prefer fewer high-quality items over more weak ones.
- Keep questions concise and mobile-ready.

JSON example (omit fields that do not belong to the type; never copy placeholders):
[{"type":"sentence_writing","wordId":"word-id","targetWord":"example","minWords":7,"keywordHints":["daily life"],"instructions":["Write in the language you are studying.","Use the target word naturally.","Write at least 7 words."],"helpfulTips":["Keep the sentence concrete and natural."],"sampleAnswer":"A natural sample sentence with the target word."}]`;
}

function isImageChoiceType(type: QuizQuestionType): boolean {
  return type === "image_based" || type === "word_to_picture" || type === "picture_to_word";
}

function buildAiImageUrl(_record: Record<string, unknown>, word?: IVocabularyWord) {
  if (!word) return undefined;
  return buildImageUrlFromHelpers(word);
}

function getImageWordDistractors(words: IVocabularyWord[], word?: IVocabularyWord): string[] {
  if (!word) return [];
  return getDistractorValues(words, word.id, (candidate) => candidate.word)
    .filter((value) => !hasTooSimilarSpelling(value, word.word));
}

function buildCompactExercisePrompt(params: RoadmapExerciseGenerationParams) {
  const targetLanguage = normalizeLanguageCode(params.user.studyLanguage, "en");
  const nativeLanguage = normalizeLanguageCode(params.user.nativeLanguage, "ru");
  const count = Math.max(10, params.count ?? (params.mode === "challenge" ? 12 : 10));
  const wordLines = params.words
    .slice(0, 12)
    .map((word) =>
      [
        `id=${word.id}`,
        `w=${word.word}`,
        `tr=${word.translation}`,
        `def=${word.definition}`,
        `ex=${word.exampleSentence}`,
        `topic=${word.topic ?? "daily life"}`,
      ].join(" | ")
    )
    .join("\n");
  const mediaLine = params.media
    ? [
        `title=${params.media.clipTitle}`,
        `url=${params.media.sourceUrl}`,
        `transcript=${params.media.transcriptSegment}`,
        `seconds=${params.media.startSeconds}-${params.media.endSeconds}`,
      ].join(" | ")
    : "none";
  const recentWordLine = params.recentWordIds?.length
    ? params.recentWordIds.slice(0, 24).join(", ")
    : "none";

  return `AsaLingo exercise generator. Return a strict JSON array only.

ctx: target=${targetLanguage} (${getLanguageName(targetLanguage)}) | native=${nativeLanguage} (${getLanguageName(nativeLanguage)}) | level=${params.user.currentLevel} | learnerStage=${params.user.learnerStage} | scriptStage=${params.user.scriptStage} | mode=${params.mode}
roadmap: title=${params.node.title} | objective=${params.node.objective} | grammar=${params.node.grammarTargets.join(", ") || "none"} | interests=${params.user.interests?.join(", ") || params.node.interestTags.join(", ") || "daily life"}
types=${params.exerciseTypes.join(", ")}
count=${count}
useOnlyWordIds=yes
openWritingWordId=lesson:${params.node._id}
recentWordIds=${recentWordLine}
media=${mediaLine}

words:
${wordLines}

rules:
- Fresh items only — author every question from the word data above. Do not reproduce memorised stock test questions.
- Instructions/questions for the learner in ${getLanguageName(nativeLanguage)}.
- Sentences, passages, options, dictation text, and production prompts in ${getLanguageName(targetLanguage)} unless the task explicitly tests translation into ${getLanguageName(nativeLanguage)}.
- Respect learner stage and script stage. For Japanese beginner script stages, avoid unsupported kanji.
- CORRECTNESS: For every choice task, verify the correctAnswer is factually correct before including it. The correctAnswer must match one option exactly (same string, same language). Distractors must be plausible but clearly wrong; never let a distractor accidentally be a correct answer.
- LANGUAGE CONSISTENCY: All options in a single choice task must be in the same language. If correctAnswer is in ${getLanguageName(nativeLanguage)}, every distractor must also be in ${getLanguageName(nativeLanguage)}. If correctAnswer is in ${getLanguageName(targetLanguage)}, every distractor must be in ${getLanguageName(targetLanguage)}.
- Choice tasks: exactly 4 options; distractors from the same semantic domain and part of speech; no near-spelling clones (differ by only 1-2 characters is forbidden).
- Variety: at least ${Math.min(6, params.exerciseTypes.length)} different types, and never place the same type twice in a row.
- Coverage: do not use the same wordId more than twice; aim for at least ${Math.min(8, params.words.length)} different wordIds.
- NON-REPETITION: Each question stem must be distinct. Do not reuse the same sentence or phrase across multiple items even with a different target word.
- Avoid bland meta prompts like "What does X mean?" unless A1 and intentionally simple.
- fill_blank and choose_missing_word: use a real sentence with a visible blank such as "_____".
- paraphrase_choice: 2-3 sentence context, not a single example sentence.
- reading_comprehension: 3-5 sentence passage with a concrete situation.
- reorder_words: tokens must be a shuffled version of correctAnswer.
- matching: 3-4 pairs.
- writing/open tasks: include prompt, minWords, rubric (3-5 rules), sampleAnswer. For sentence_writing, include non-empty keywordHints, instructions, and helpfulTips.
- Return minimal objects only: include only fields needed for that type. No empty strings, empty arrays, nulls, or unused keys.

minimal type fields:
- multiple_choice: type, wordId, options, correctAnswer
- fill_blank: type, wordId, sentence, options, correctAnswer
- translation_input: type, wordId, promptWord, correctAnswer, acceptedAnswers
- reverse_multiple_choice: type, wordId, promptTranslation, options, correctAnswer
- sentence_writing: type, wordId, targetWord, minWords, non-empty keywordHints, non-empty instructions, non-empty helpfulTips, sampleAnswer
- image_based: type, wordId, options, correctAnswer. Do not include imageUrl; the server attaches a filtered image from wordId. correctAnswer must be the exact target word for wordId.
- reorder_words: type, wordId, tokens, correctSentence or correctAnswer
- matching: type, wordId, pairs
- script_recognition, reading_association: type, wordId, promptText, reading, options, correctAnswer
- reading_comprehension, paraphrase_choice, media_comprehension: type, wordId, passage, options, correctAnswer
- error_correction: type, wordId, sentence, incorrectSegment, correctAnswer, acceptedAnswers
- open_translation, translation_variants, short_paragraph_response, summary, argument_response, essay_writing: type, wordId, prompt, minWords, rubric, sampleAnswer
- transcript_gap_fill, media_transcript: type, wordId, transcriptWithBlank, promptText, correctAnswer, acceptedAnswers, options (only for transcript_gap_fill)
- word_to_picture, picture_to_word, tap_translation, tap_heard_phrase, choose_missing_word, fill_in_context, short_dictation: type, wordId, promptText or sentence, options, correctAnswer. For word_to_picture and picture_to_word, do not include imageUrl and use the exact target word for wordId as correctAnswer.

example:
[{"type":"multiple_choice","wordId":"...","options":["a","b","c","d"],"correctAnswer":"a"}]`;
}

function getSimpleQuestionFallback(
  type: QuizQuestionType,
  nativeLanguage: string,
  word?: IVocabularyWord,
  fallbackText?: string
): string | undefined {
  switch (type) {
    case "multiple_choice":
      return word ? getLocalInstruction("choose_meaning", nativeLanguage, word.word) : fallbackText;
    case "fill_blank":
    case "choose_missing_word":
      return getLocalInstruction("complete_sentence", nativeLanguage);
    case "translation_input":
      return word ? getLocalInstruction("choose_translation", nativeLanguage, word.word) : fallbackText;
    case "reverse_multiple_choice": {
      const promptTranslation = pickPromptTranslation("", word?.translation);
      return promptTranslation
        ? getLocalInstruction("which_word_matches", nativeLanguage, promptTranslation)
        : fallbackText;
    }
    case "image_based":
    case "word_to_picture":
    case "picture_to_word":
      return getLocalInstruction("choose_word_for_image", nativeLanguage);
    case "reorder_words":
      return getLocalInstruction("reorder_words", nativeLanguage);
    case "matching":
      return getLocalInstruction("match_words", nativeLanguage);
    default:
      return fallbackText;
  }
}

function buildExerciseBase(params: {
  type: QuizQuestionType;
  record: Record<string, unknown>;
  word?: IVocabularyWord;
  node: ICurriculumNode;
  user: IUser;
  question: string;
  answerSeed: string;
}) {
  const metadata = getExerciseMetadata(params.type);
  const recordScriptSupport = params.record.scriptSupport as Record<string, unknown> | undefined;
  const scriptStage = cleanText(recordScriptSupport?.scriptStage) || params.node.scriptFocus || params.user.scriptStage;
  const promptText = cleanGeneratedExerciseText(params.record.promptText, params.word);
  const reading = cleanText(params.record.reading);
  const romaji = cleanText(params.record.romaji);
  const shouldAttachScript =
    normalizeLanguageCode(params.user.studyLanguage, "en") === "ja" ||
    metadata.skill === "script" ||
    Boolean(params.node.scriptFocus);
  const wordId = params.word?.id ?? (cleanText(params.record.wordId) || `lesson:${params.node._id}`);

  return {
    question: params.question,
    wordId,
    questionHash: createQuestionHash({
      type: params.type,
      wordId,
      question: params.question,
      answerSeed: params.answerSeed,
    }),
    roadmapNodeId: String(params.node._id),
    exerciseMeta: {
      skill: metadata.skill,
      difficulty: metadata.defaultDifficulty,
      stageSuitability: metadata.suitableStages,
      evaluationMode: metadata.evaluationMode,
      mediaNeeds: metadata.mediaNeeds,
      templateFamily: metadata.templateFamily,
    },
    ...(params.word ? { wordInfo: getWordInfo(params.word) } : {}),
    ...(shouldAttachScript
      ? {
          scriptSupport: {
            scriptStage,
            displayText: cleanText(recordScriptSupport?.displayText) || promptText || params.word?.word,
            reading: reading || params.word?.pronunciation,
            romaji: romaji || params.word?.word,
          },
        }
      : {}),
  };
}

function getPairs(value: unknown, word?: Pick<IVocabularyWord, "word" | "translation">) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Record<string, unknown>;
      const left = cleanGeneratedExerciseText(record.left, word);
      const right = cleanGeneratedExerciseText(record.right, word);
      return left && right ? { left, right } : null;
    })
    .filter((item): item is { left: string; right: string } => Boolean(item))
    .slice(0, 4);
}

function validateRoadmapExercises(
  value: unknown,
  params: RoadmapExerciseGenerationParams
): QuizQuestion[] {
  const rawItems = Array.isArray(value)
    ? value
    : Array.isArray((value as Record<string, unknown>)?.exercises)
      ? ((value as Record<string, unknown>).exercises as unknown[])
      : [];
  if (rawItems.length === 0) throw new Error("Expected an array of generated exercises");

  const allowedTypes = new Set(params.exerciseTypes);
  const wordsById = new Map(params.words.map((word) => [word.id, word]));
  const questions: QuizQuestion[] = [];
  const nativeLanguage = normalizeLanguageCode(params.user.nativeLanguage, "ru");

  for (const [index, item] of rawItems.entries()) {
    const record = item as Record<string, unknown>;
    const type = cleanText(record.type) as QuizQuestionType;
    if (!allowedTypes.has(type as ExerciseType)) continue;

    const explicitWord = wordsById.get(cleanText(record.wordId));
    const word = explicitWord ?? params.words[index % Math.max(params.words.length, 1)];
    const cleanRecordText = (value: unknown) => cleanGeneratedExerciseText(value, word);
    const cleanRecordArray = (value: unknown, limit = 8) =>
      cleanGeneratedExerciseStringArray(value, word, limit);
    const recordQuestion = cleanRecordText(record.question);
    const question =
      getSimpleQuestionFallback(type, nativeLanguage, word, recordQuestion) ||
      recordQuestion ||
      getExerciseMetadata(type).label;
    const recordCorrectAnswer = cleanRecordText(record.correctAnswer);
    const correctAnswer = isImageChoiceType(type) && word ? cleanText(word.word) : recordCorrectAnswer;
    const acceptedAnswers = ensureOptionIncluded(cleanRecordArray(record.acceptedAnswers, 6), correctAnswer, 6);
    const base = buildExerciseBase({
      type,
      record,
      word: word && !cleanText(record.wordId).startsWith("lesson:") ? word : undefined,
      node: params.node,
      user: params.user,
      question,
      answerSeed: correctAnswer || cleanRecordText(record.prompt) || cleanRecordText(record.passage),
    });

    switch (type) {
      case "multiple_choice": {
        const options = normalizeChoiceOptions(
          cleanRecordArray(record.options, 8),
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        if (!correctAnswer || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({ ...base, type, options, correctAnswer });
        break;
      }
      case "fill_blank": {
        const options = normalizeChoiceOptions(
          cleanRecordArray(record.options, 8),
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        const sentence = pickFillBlankSentence(cleanRecordText(record.sentence), correctAnswer, word?.exampleSentence);
        if (!correctAnswer || !sentence || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({ ...base, type, sentence, options, correctAnswer, acceptedAnswers });
        break;
      }
      case "translation_input": {
        const promptWord = cleanRecordText(record.promptWord) || word?.word;
        if (!promptWord || !correctAnswer) continue;
        questions.push({ ...base, type, promptWord, correctAnswer, acceptedAnswers });
        break;
      }
      case "reverse_multiple_choice": {
        const options = normalizeChoiceOptions(
          cleanRecordArray(record.options, 8),
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        const promptTranslation = pickPromptTranslation(cleanRecordText(record.promptTranslation), word?.translation);
        if (!promptTranslation || !correctAnswer || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({ ...base, type, promptTranslation, options, correctAnswer });
        break;
      }
      case "sentence_writing": {
        const targetWord = cleanText(record.targetWord) || word?.word;
        if (!targetWord) continue;
        const support = buildSentenceWritingSupport({
          level: params.user.currentLevel,
          targetWord,
          word,
          minWords: record.minWords,
          keywordHints: record.keywordHints,
          instructions: record.instructions,
          helpfulTips: record.helpfulTips,
        });
        questions.push({
          ...base,
          type,
          targetWord,
          minWords: support.minWords,
          keywordHints: support.keywordHints,
          instructions: support.instructions,
          helpfulTips: support.helpfulTips,
          sampleAnswer: cleanRecordText(record.sampleAnswer) || undefined,
        });
        break;
      }
      case "image_based": {
        if (!word) continue;
        const imageUrl = buildAiImageUrl(record, word);
        const options = normalizeChoiceOptions(
          [
            word.word,
            ...cleanRecordArray(record.options, 8),
            ...getImageWordDistractors(params.words, word),
          ],
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        if (!imageUrl || !correctAnswer || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({
          ...base,
          type,
          imageUrl,
          options,
          correctAnswer,
          acceptedAnswers,
        });
        break;
      }
      case "reorder_words": {
        const answer = correctAnswer || cleanRecordText(record.correctSentence);
        const tokens = cleanRecordArray(record.tokens, 12);
        const finalTokens = tokens.length ? tokens : answer.split(/\s+/).filter(Boolean);
        if (!answer || finalTokens.length < 2) continue;
        questions.push({ ...base, type, tokens: finalTokens, correctAnswer: answer, acceptedAnswers: [answer] });
        break;
      }
      case "matching": {
        const pairs = getPairs(record.pairs, word);
        if (pairs.length < 3) continue;
        questions.push({
          ...base,
          type,
          pairs,
          options: cleanRecordArray(record.options, 8).length
            ? cleanRecordArray(record.options, 8)
            : pairs.map((pair) => pair.right),
          correctAnswer: JSON.stringify(pairs),
        });
        break;
      }
      case "script_recognition":
      case "reading_association": {
        const options = normalizeChoiceOptions(
          cleanRecordArray(record.options, 8),
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        const promptText = cleanRecordText(record.promptText);
        if (!promptText || !correctAnswer || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({
          ...base,
          type,
          promptText,
          reading: cleanRecordText(record.reading) || word?.pronunciation,
          options,
          correctAnswer,
          acceptedAnswers,
        });
        break;
      }
      case "reading_comprehension":
      case "paraphrase_choice":
      case "media_comprehension": {
        const passage = cleanRecordText(record.passage);
        const options = normalizeChoiceOptions(
          cleanRecordArray(record.options, 8),
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        if (!passage || !correctAnswer || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({
          ...base,
          type,
          ...(type === "media_comprehension" && params.media
            ? {
                media: {
                  sourceUrl: params.media.sourceUrl,
                  provider: params.media.provider,
                  clipTitle: params.media.clipTitle,
                  startSeconds: params.media.startSeconds,
                  endSeconds: params.media.endSeconds,
                },
              }
            : {}),
          passage,
          options,
          correctAnswer,
        });
        break;
      }
      case "error_correction": {
        const sentence = cleanRecordText(record.sentence);
        if (!sentence || !correctAnswer) continue;
        questions.push({
          ...base,
          type,
          sentence,
          incorrectSegment: cleanRecordText(record.incorrectSegment) || undefined,
          correctAnswer,
          acceptedAnswers,
        });
        break;
      }
      case "open_translation":
      case "translation_variants":
      case "short_paragraph_response":
      case "summary":
      case "argument_response":
      case "essay_writing": {
        const prompt = cleanRecordText(record.prompt);
        if (!prompt) continue;
        questions.push({
          ...base,
          type,
          prompt,
          minWords: coerceNumber(record.minWords, type === "argument_response" || type === "essay_writing" ? 80 : 35, 8, 220),
          rubric: cleanRecordArray(record.rubric, 6),
          sampleAnswer: cleanRecordText(record.sampleAnswer) || undefined,
        });
        break;
      }
      case "transcript_gap_fill":
      case "media_transcript": {
        if (!params.media || !correctAnswer) continue;
        const options =
          type === "transcript_gap_fill"
            ? normalizeChoiceOptions(
                cleanRecordArray(record.options, 8),
                correctAnswer,
                `${type}|${base.wordId}|${question}`
              )
            : [];
        if (type === "transcript_gap_fill" && options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({
          ...base,
          type,
          media: {
            sourceUrl: params.media.sourceUrl,
            provider: params.media.provider,
            clipTitle: params.media.clipTitle,
            startSeconds: params.media.startSeconds,
            endSeconds: params.media.endSeconds,
          },
          transcriptWithBlank: cleanRecordText(record.transcriptWithBlank),
          promptText: cleanRecordText(record.promptText) || undefined,
          options,
          correctAnswer,
          acceptedAnswers,
        });
        break;
      }
      case "word_to_picture":
      case "picture_to_word":
      case "tap_translation":
      case "tap_heard_phrase":
      case "choose_missing_word":
      case "fill_in_context":
      case "short_dictation": {
        if ((type === "word_to_picture" || type === "picture_to_word") && !word) continue;
        const imageUrl =
          type === "word_to_picture" || type === "picture_to_word"
            ? buildAiImageUrl(record, word)
            : cleanRecordText(record.imageUrl) || undefined;
        const options = normalizeChoiceOptions(
          type === "word_to_picture" || type === "picture_to_word"
            ? [
                word?.word ?? correctAnswer,
                ...cleanRecordArray(record.options, 8),
                ...getImageWordDistractors(params.words, word),
              ]
            : cleanRecordArray(record.options, 8),
          correctAnswer,
          `${type}|${base.wordId}|${question}`
        );
        if ((type === "word_to_picture" || type === "picture_to_word") && !imageUrl) continue;
        if (!correctAnswer || options.length < MIN_CHOICE_OPTIONS) continue;
        questions.push({
          ...base,
          type,
          promptText: cleanRecordText(record.promptText) || undefined,
          sentence: cleanRecordText(record.sentence) || undefined,
          imageUrl,
          options,
          correctAnswer,
          acceptedAnswers,
        });
        break;
      }
      default:
        break;
    }
  }

  const requiredCount = getRoadmapExerciseTargetCount(params);
  const selected = selectDiverseQuizQuestions(questions, requiredCount, {
    recentQuestionHashes: params.recentQuestionHashes ?? [],
    recentWordIds: params.recentWordIds ?? [],
    seed: `${params.node._id}|${params.mode}|ai|${Date.now()}`,
  });

  const minRequired = Math.ceil(requiredCount * 0.6);
  if (selected.length < minRequired) {
    throw new Error(`AI returned too few high-quality exercises (${selected.length}/${requiredCount})`);
  }
  return selected;
}

function getRoadmapExerciseTargetCount(params: RoadmapExerciseGenerationParams): number {
  return Math.max(10, params.count ?? (params.mode === "challenge" ? 12 : 10));
}

function attachRoadmapContext<T extends QuizQuestion>(
  question: T,
  params: RoadmapExerciseGenerationParams,
  word?: IVocabularyWord
): T {
  const metadata = getExerciseMetadata(question.type);
  const shouldAttachScript =
    normalizeLanguageCode(params.user.studyLanguage, "en") === "ja" ||
    metadata.skill === "script" ||
    Boolean(params.node.scriptFocus);

  return {
    ...question,
    roadmapNodeId: String(params.node._id),
    exerciseMeta: {
      skill: metadata.skill,
      difficulty: metadata.defaultDifficulty,
      stageSuitability: metadata.suitableStages,
      evaluationMode: metadata.evaluationMode,
      mediaNeeds: metadata.mediaNeeds,
      templateFamily: metadata.templateFamily,
    },
    ...(shouldAttachScript
      ? {
          scriptSupport: {
            scriptStage: params.node.scriptFocus || params.user.scriptStage,
            displayText: word?.word,
            reading: word?.pronunciation,
            romaji: word?.word,
          },
        }
      : {}),
  };
}

function getChoiceOptions(
  correctAnswer: string,
  distractors: string[],
  seed: string,
  limit = 4
): string[] {
  return normalizeChoiceOptions(
    [
      correctAnswer,
      ...distractors.filter((item) => normalizeAnswer(item) !== normalizeAnswer(correctAnswer)),
    ],
    correctAnswer,
    seed,
    limit
  );
}

function getBlankedExampleSentence(word: IVocabularyWord): string | undefined {
  const sourceSentence = cleanText(word.exampleSentence);
  if (!sourceSentence) return undefined;
  const pattern = new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!pattern.test(sourceSentence)) return undefined;
  return sourceSentence.replace(pattern, "_____");
}

function getSentenceTokens(sentence: string, seed: string): string[] {
  const tokens = cleanText(sentence)
    .replace(/[.!?]+$/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  if (tokens.length < 2) return [];
  return shuffleValues(tokens, seed);
}

function buildLocalRoadmapBase(params: {
  type: QuizQuestionType;
  roadmap: RoadmapExerciseGenerationParams;
  word?: IVocabularyWord;
  question: string;
  answerSeed: string;
  record?: Record<string, unknown>;
}) {
  return buildExerciseBase({
    type: params.type,
    record: {
      ...(params.record ?? {}),
      wordId: params.word?.id ?? `lesson:${params.roadmap.node._id}`,
    },
    word: params.word,
    node: params.roadmap.node,
    user: params.roadmap.user,
    question: params.question,
    answerSeed: params.answerSeed,
  });
}

type MediaComprehensionSeed = {
  question: string;
  passage: string;
  correctAnswer: string;
  options: string[];
};

function getMediaComprehensionSeeds(media: IMediaTask): MediaComprehensionSeed[] {
  const rawQuestions = Array.isArray(media.questions) ? media.questions : [];
  return rawQuestions
    .map((item) => ({
      question: cleanText(item.question),
      passage: cleanText(item.passage),
      correctAnswer: cleanText(item.correctAnswer),
      options: cleanUniqueStringArray(item.options, 8),
    }))
    .filter((item) => item.question && item.passage && item.correctAnswer && item.options.length >= MIN_CHOICE_OPTIONS);
}

function pickMediaComprehensionSeed(media: IMediaTask, seed: string): MediaComprehensionSeed | null {
  const candidates = getMediaComprehensionSeeds(media);
  if (candidates.length === 0) return null;
  const index = parseInt(crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) % candidates.length;
  return candidates[index] ?? null;
}

function buildLocalMatchingExercise(
  params: RoadmapExerciseGenerationParams,
  words: IVocabularyWord[],
  offset: number
): QuizQuestion | null {
  const pairWords = words.slice(offset).concat(words.slice(0, offset)).slice(0, 4);
  const pairs = pairWords
    .map((word) => ({
      left: cleanText(word.word),
      right: cleanText(word.translation),
    }))
    .filter((pair) => pair.left && pair.right);

  if (pairs.length < 3) return null;

  const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
  const question = getLocalInstruction("match_words", nativeLang);
  const base = buildLocalRoadmapBase({
    type: "matching",
    roadmap: params,
    question,
    answerSeed: pairs.map((pair) => `${pair.left}:${pair.right}`).join("|"),
  });

  return {
    ...base,
    type: "matching",
    pairs,
    options: shuffleValues(pairs.map((pair) => pair.right), `${offset}|matching`),
    correctAnswer: JSON.stringify(pairs),
  } as QuizQuestion;
}

function makeIncorrectSentence(word: IVocabularyWord, words: IVocabularyWord[]): string | undefined {
  const sentence = cleanText(word.exampleSentence);
  if (!sentence) return undefined;
  const distractor = words.find(
    (candidate) =>
      candidate.id !== word.id &&
      candidate.partOfSpeech === word.partOfSpeech &&
      normalizeAnswer(candidate.word) !== normalizeAnswer(word.word)
  ) ?? words.find((candidate) => candidate.id !== word.id);
  if (!distractor) return undefined;

  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  if (pattern.test(sentence)) return sentence.replace(pattern, distractor.word);

  const tokens = sentence.split(/\s+/);
  if (tokens.length < 3) return undefined;
  tokens[Math.min(1, tokens.length - 1)] = distractor.word;
  return tokens.join(" ");
}

function buildLocalRoadmapQuestionForType(
  type: ExerciseType,
  word: IVocabularyWord,
  params: RoadmapExerciseGenerationParams,
  ctx: QuizBuildContext
): QuizQuestion | null {
  const quizType = type as QuizQuestionType;
  const coreQuestion = buildQuestionForType(quizType, word, ctx);
  if (coreQuestion) return attachRoadmapContext(coreQuestion, params, word);

  switch (type) {
    case "tap_translation": {
      const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
      const translationDistractors = getDistractorValues(
        params.words, word.id, (candidate) => candidate.translation
      ).filter((v) => !hasTooSimilarSpelling(v, word.translation));
      const options = getChoiceOptions(word.translation, translationDistractors, `${word.id}|tap_translation`);
      if (options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getLocalInstruction("choose_translation", nativeLang, word.word);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question,
          answerSeed: word.translation,
        }),
        type,
        promptText: word.word,
        options,
        correctAnswer: word.translation,
        acceptedAnswers: getAnswerVariants(word.translation, word.translation),
      } as QuizQuestion;
    }
    case "choose_missing_word":
    case "fill_in_context": {
      const sentence = getBlankedExampleSentence(word);
      const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
      const wordDistractors = getDistractorValues(
        params.words, word.id, (candidate) => candidate.word
      ).filter((v) => !hasTooSimilarSpelling(v, word.word));
      const options = getChoiceOptions(word.word, wordDistractors, `${word.id}|${type}`);
      if (!sentence || options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getLocalInstruction("complete_sentence", nativeLang);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question,
          answerSeed: word.word,
        }),
        type,
        sentence,
        options,
        correctAnswer: word.word,
        acceptedAnswers: getAnswerVariants(word.word),
      } as QuizQuestion;
    }
    case "reorder_words": {
      const answer = cleanText(word.exampleSentence);
      const tokens = getSentenceTokens(answer, `${word.id}|reorder_words`);
      if (!answer || tokens.length < 2) return null;
      const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
      const question = getLocalInstruction("reorder_words", nativeLang);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question,
          answerSeed: answer,
        }),
        type,
        tokens,
        correctAnswer: answer,
        acceptedAnswers: [answer],
      } as QuizQuestion;
    }
    case "word_to_picture":
    case "picture_to_word": {
      const imageUrl = buildImageUrlFromHelpers(word);
      const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
      const picDistractors = getDistractorValues(
        params.words, word.id, (candidate) => candidate.word
      ).filter((v) => !hasTooSimilarSpelling(v, word.word));
      const options = getChoiceOptions(word.word, picDistractors, `${word.id}|${type}`);
      if (!imageUrl || options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getLocalInstruction("choose_word_for_image", nativeLang);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question,
          answerSeed: word.word,
        }),
        type,
        imageUrl,
        options,
        correctAnswer: word.word,
        acceptedAnswers: getAnswerVariants(word.word),
      } as QuizQuestion;
    }
    case "script_recognition":
    case "reading_association": {
      const correctAnswer = cleanText(word.pronunciation) || word.word;
      const options = getChoiceOptions(
        correctAnswer,
        getDistractorValues(params.words, word.id, (candidate) => candidate.pronunciation || candidate.word),
        `${word.id}|${type}`
      );
      if (options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getScriptExercisePrompt(type, params.user.nativeLanguage);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question,
          answerSeed: correctAnswer,
          record: { promptText: word.word, reading: correctAnswer },
        }),
        type,
        promptText: word.word,
        reading: correctAnswer,
        options,
        correctAnswer,
        acceptedAnswers: getAnswerVariants(correctAnswer),
      } as QuizQuestion;
    }
    case "reading_comprehension": {
      // Uses the example sentence as a real reading passage; asks about the word's meaning in context.
      const passage = cleanText(word.exampleSentence);
      if (!passage) return null;
      const correctAnswer = cleanText(word.translation);
      if (!correctAnswer) return null;
      const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
      const distractors = getDistractorValues(params.words, word.id, (c) => c.translation).filter(
        (v) => normalizeAnswer(v) !== normalizeAnswer(correctAnswer) && !hasTooSimilarSpelling(v, correctAnswer)
      );
      const options = getChoiceOptions(correctAnswer, distractors, `${word.id}|reading_comprehension`);
      if (options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getLocalInstruction("read_and_choose_meaning", nativeLang, word.word);
      return {
        ...buildLocalRoadmapBase({ type: quizType, roadmap: params, word, question, answerSeed: correctAnswer }),
        type,
        passage,
        options,
        correctAnswer,
      } as QuizQuestion;
    }
    case "paraphrase_choice": {
      // Shows example sentence as passage; asks what the word means in that context using definitions.
      // Distractors come from same-POS or same-topic words for more plausible choices.
      const passage = cleanText(word.exampleSentence);
      if (!passage) return null;
      const correctAnswer = cleanText(word.definition);
      if (!correctAnswer) return null;
      const nativeLang = normalizeLanguageCode(params.user.nativeLanguage, "ru");
      const samePosDistractors = params.words
        .filter((c) => c.id !== word.id && c.partOfSpeech === word.partOfSpeech)
        .map((c) => cleanText(c.definition))
        .filter(Boolean);
      const fallbackDistractors = getDistractorValues(params.words, word.id, (c) => c.definition);
      const allDistractors = [...samePosDistractors, ...fallbackDistractors].filter(
        (v) => normalizeAnswer(v) !== normalizeAnswer(correctAnswer) && !hasTooSimilarSpelling(v, correctAnswer)
      );
      const options = getChoiceOptions(correctAnswer, allDistractors, `${word.id}|paraphrase_choice`);
      if (options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getLocalInstruction("paraphrase_meaning", nativeLang, word.word);
      return {
        ...buildLocalRoadmapBase({ type: quizType, roadmap: params, word, question, answerSeed: correctAnswer }),
        type,
        passage,
        options,
        correctAnswer,
      } as QuizQuestion;
    }
    case "media_comprehension": {
      if (!params.media) return null;
      const mediaSeed = pickMediaComprehensionSeed(params.media, `${params.media._id}|${params.node._id}`);
      if (!mediaSeed) return null;
      const options = normalizeChoiceOptions(
        mediaSeed.options,
        mediaSeed.correctAnswer,
        `${params.media.sourceUrl}|media_comprehension`
      );
      if (options.length < MIN_CHOICE_OPTIONS) return null;
      const question = getMediaComprehensionPrompt(params.user.nativeLanguage);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          question,
          answerSeed: mediaSeed.correctAnswer,
          record: { wordId: `media:${params.media._id ?? params.node._id}` },
        }),
        type,
        media: {
          sourceUrl: params.media.sourceUrl,
          provider: params.media.provider,
          clipTitle: params.media.clipTitle,
          startSeconds: params.media.startSeconds,
          endSeconds: params.media.endSeconds,
        },
        passage: `${mediaSeed.question} ${mediaSeed.passage}`.trim(),
        options,
        correctAnswer: mediaSeed.correctAnswer,
      } as QuizQuestion;
    }
    case "open_translation":
    case "translation_variants": {
      const localized = getOpenTranslationTexts(type, params.user.nativeLanguage, {
        sentence: word.exampleSentence,
        word: word.word,
      });
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question: localized.question,
          answerSeed: word.translation,
        }),
        type,
        prompt: localized.prompt,
        minWords: type === "open_translation" ? 2 : 1,
        rubric: localized.rubric,
        sampleAnswer: type === "open_translation" ? word.translation : `${word.translation}`,
      } as QuizQuestion;
    }
    case "error_correction": {
      const sentence = makeIncorrectSentence(word, params.words);
      const correctAnswer = cleanText(word.exampleSentence);
      if (!sentence || !correctAnswer || normalizeAnswer(sentence) === normalizeAnswer(correctAnswer)) return null;
      const question = getErrorCorrectionPrompt(params.user.nativeLanguage);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question,
          answerSeed: correctAnswer,
        }),
        type,
        sentence,
        incorrectSegment: undefined,
        correctAnswer,
        acceptedAnswers: [correctAnswer],
      } as QuizQuestion;
    }
    case "short_paragraph_response": {
      const topic = cleanText(word.topic) || params.node.interestTags[0] || "daily life";
      const localized = getGuidedWritingTexts("short_paragraph_response", params.user.nativeLanguage, {
        topic,
        word: word.word,
      });
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question: localized.question,
          answerSeed: localized.prompt,
        }),
        type,
        prompt: localized.prompt,
        minWords: 30,
        rubric: localized.rubric,
        sampleAnswer: word.exampleSentence,
      } as QuizQuestion;
    }
    case "summary": {
      const passage = [word.exampleSentence, word.definition].map(cleanText).filter(Boolean).join(" ");
      if (!passage) return null;
      const localized = getGuidedWritingTexts("summary", params.user.nativeLanguage, { passage });
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question: localized.question,
          answerSeed: passage,
        }),
        type,
        prompt: localized.prompt,
        minWords: 20,
        rubric: localized.rubric,
        sampleAnswer: word.definition,
      } as QuizQuestion;
    }
    case "argument_response": {
      const topic = cleanText(word.topic) || params.node.interestTags[0] || "communication";
      const localized = getGuidedWritingTexts("argument_response", params.user.nativeLanguage, {
        topic,
        word: word.word,
      });
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question: localized.question,
          answerSeed: localized.prompt,
        }),
        type,
        prompt: localized.prompt,
        minWords: 55,
        rubric: localized.rubric,
        sampleAnswer: undefined,
      } as QuizQuestion;
    }
    case "essay_writing": {
      const topic = cleanText(word.topic) || params.node.interestTags[0] || "culture";
      const localized = getGuidedWritingTexts("essay_writing", params.user.nativeLanguage, { topic });
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          word,
          question: localized.question,
          answerSeed: localized.prompt,
        }),
        type,
        prompt: localized.prompt,
        minWords: 90,
        rubric: localized.rubric,
        sampleAnswer: undefined,
      } as QuizQuestion;
    }
    case "transcript_gap_fill":
    case "media_transcript": {
      if (!params.media) return null;
      const blank = getMediaBlankFromHelpers(params.media, params.words.map((candidate) => candidate.word));
      if (!blank) return null;
      const question = getMediaExercisePrompt(type, params.user.nativeLanguage);
      return {
        ...buildLocalRoadmapBase({
          type: quizType,
          roadmap: params,
          question,
          answerSeed: blank.answer,
          record: { wordId: `media:${params.media._id ?? params.node._id}` },
        }),
        type,
        media: {
          sourceUrl: params.media.sourceUrl,
          provider: params.media.provider,
          clipTitle: params.media.clipTitle,
          startSeconds: params.media.startSeconds,
          endSeconds: params.media.endSeconds,
        },
        transcriptWithBlank: blank.transcriptWithBlank,
        promptText: params.media.clipTitle,
        options: type === "transcript_gap_fill"
          ? getChoiceOptions(
              blank.answer,
              params.words.map((candidate) => candidate.word),
              `${params.media.sourceUrl}|${type}`
            )
          : [],
        correctAnswer: blank.answer,
        acceptedAnswers: getAnswerVariants(blank.answer),
      } as QuizQuestion;
    }
    default:
      return null;
  }
}

function buildLocalRoadmapExercises(params: RoadmapExerciseGenerationParams): QuizQuestion[] {
  const targetCount = getRoadmapExerciseTargetCount(params);
  const words = params.words.map((word) => asVocabularyWord(word as unknown as Record<string, unknown>));
  if (words.length === 0) return [];

  const usableTypes = params.exerciseTypes.filter((type) => {
    const metadata = getExerciseMetadata(type);
    if (metadata.mediaNeeds === "audio") return false;
    if (metadata.mediaNeeds === "video") return Boolean(params.media);
    return true;
  });

  if (usableTypes.length === 0) return [];

  const ctx: QuizBuildContext = {
    level: params.user.currentLevel,
    nativeLanguage: normalizeLanguageCode(params.user.nativeLanguage, "ru"),
    words,
    includeWordInfo: true,
    recentQuestionHashes: new Set(params.recentQuestionHashes ?? []),
    recentWordIds: new Set(params.recentWordIds ?? []),
    usedHashes: new Set<string>(),
    usedWordIds: new Set<string>(),
    usedTypes: new Map<QuizQuestionType, number>(),
    sessionSeed: crypto.randomBytes(8).toString("hex"),
  };
  const candidates: QuizQuestion[] = [];

  for (const type of usableTypes) {
    if (type === "matching") {
      for (let offset = 0; offset < words.length; offset += 1) {
        const question = buildLocalMatchingExercise(params, words, offset);
        if (question) candidates.push(question);
      }
      continue;
    }

    for (const word of words) {
      const question = buildLocalRoadmapQuestionForType(type, word, params, ctx);
      if (question) candidates.push(question);
    }
  }

  return selectDiverseQuizQuestions(candidates, targetCount, {
    recentQuestionHashes: params.recentQuestionHashes ?? [],
    recentWordIds: params.recentWordIds ?? [],
    seed: `${params.node._id}|${params.mode}|local|${Date.now()}`,
  });
}

export async function generateRoadmapExercises(
  params: RoadmapExerciseGenerationParams
): Promise<QuizQuestion[]> {
  if (params.words.length === 0) throw new Error("Cannot generate exercises without focus words");

  const targetCount = getRoadmapExerciseTargetCount(params);

  // Fast local path: build deterministic exercises from the word pool first.
  // For A1/A2 stages the local builders cover the full exercise mix well.
  // For higher levels we still prefer AI but use local as a quality floor.
  const localExercises = buildLocalRoadmapExercises(params);
  const isEarlyStage = ["A1", "A2"].includes(params.user.currentLevel) ||
    ["absolute_beginner", "early_beginner"].includes(params.user.learnerStage);
  const needsImageExercise = params.exerciseTypes.some((type) => getExerciseMetadata(type).mediaNeeds === "image");
  const needsVideoExercise = params.exerciseTypes.some((type) => getExerciseMetadata(type).mediaNeeds === "video");
  const localHasImageExercise = localExercises.some((exercise) => exercise.exerciseMeta?.mediaNeeds === "image");
  const localHasVideoExercise = localExercises.some((exercise) => exercise.exerciseMeta?.mediaNeeds === "video");

  if (!isAiConfigured()) {
    // No AI: use local exercises or fail if coverage is too thin
    if (localExercises.length >= Math.ceil(targetCount * 0.6)) {
      logger.info(`generateRoadmapExercises: AI not configured, using ${localExercises.length} local exercises`);
      return localExercises.slice(0, targetCount);
    }
    throw new Error("AI service not configured and local exercises are insufficient for this lesson");
  }

  // For early-stage learners, skip AI entirely when local coverage is sufficient.
  // This halves round-trip time for A1/A2 lessons where the exercise types are straightforward.
  if (
    isEarlyStage &&
    localExercises.length >= targetCount &&
    (!needsImageExercise || localHasImageExercise) &&
    (!needsVideoExercise || localHasVideoExercise)
  ) {
    logger.info(`generateRoadmapExercises: early-stage fast path — ${localExercises.length} local exercises`);
    return localExercises.slice(0, targetCount);
  }

  // For intermediate+ or insufficient local coverage: use AI for full generation.
  try {
    return await requestJsonWithRetry(
      (attempt, previousError) =>
        `${buildCompactExercisePrompt(params)}\n\n${
          attempt > 1 ? `Previous attempt failed: ${previousError}. Return valid strict JSON only.` : ""
        }`,
      (value) => validateRoadmapExercises(value, params)
    );
  } catch (error) {
    // AI failed — fall back to local exercises if there are enough (covers transient API outages)
    if (localExercises.length >= Math.ceil(targetCount * 0.6)) {
      logger.warn(`generateRoadmapExercises: AI failed, falling back to ${localExercises.length} local exercises: ${error}`);
      return localExercises.slice(0, targetCount);
    }
    throw error;
  }
}

const PLACEMENT_LEVEL_BY_DIFFICULTY: CefrLevel[] = ["A1", "A1", "A2", "B1", "B2", "C1", "C2"];

function getPlacementLevel(difficulty: number): CefrLevel {
  return PLACEMENT_LEVEL_BY_DIFFICULTY[Math.max(1, Math.min(6, Math.round(difficulty)))] ?? "A1";
}

function getPlacementType(skill: SkillFocus, language: string): GeneratedPlacementItemPayload["type"] {
  if (skill === "script" && language === "ja") return "script_recognition";
  if (skill === "grammar") return "fill_blank";
  if (skill === "reading") return "reading_comprehension";
  if (skill === "writing") return "short_production";
  return "multiple_choice";
}

function getPlacementScriptStage(language: string, difficulty: number): ScriptStage | undefined {
  if (language !== "ja") return ["zh", "ko"].includes(language) ? "native_script" : "latin";
  if (difficulty <= 1) return "romaji";
  if (difficulty <= 2) return "kana_intro";
  if (difficulty <= 3) return "kana_supported";
  if (difficulty <= 4) return "kanji_intro";
  if (difficulty <= 5) return "kanji_supported";
  return "kanji_confident";
}

function buildPlacementPrompt(params: PlacementItemGenerationParams) {
  const language = normalizeLanguageCode(params.language, "en");
  const nativeLanguage = normalizeLanguageCode(params.nativeLanguage, "ru");
  const difficulty = Math.max(1, Math.min(6, Math.round(params.difficulty)));
  const cefrLevel = getPlacementLevel(difficulty);
  const type = getPlacementType(params.skill, language);
  const scriptStage = getPlacementScriptStage(language, difficulty);

  return `Generate one adaptive placement-test item for AsaLingo. Strict JSON object only.

Target language: ${getLanguageName(language)} (${language})
Native language: ${getLanguageName(nativeLanguage)} (${nativeLanguage})
Skill: ${params.skill}
Item type: ${type}
Difficulty: ${difficulty}
CEFR: ${cefrLevel}
Script stage: ${scriptStage ?? "none"}
Answered count before this item: ${params.answeredCount}
Learner interests: ${params.interests?.join(", ") || "daily life, communication"}
Learning goal: ${params.learningGoal || "general communication"}
Avoid item families: ${params.avoidItemFamilies?.join(", ") || "none"}

Rules:
- Author a new item; do not use a memorized stock language-test question.
- Keep the item short enough for onboarding.
- For multiple_choice, fill_blank, reading_comprehension, and script_recognition, return exactly 4 choices and make correctAnswer exactly match one choice.
- For short_production, return no choices and provide productionRubric.
- acceptedAnswers must include correctAnswer when there is one.
- Use native language only when it helps the learner understand the task.
- Keep all answer choices in one language; never mix target-language and native-language options in the same item.
- Avoid bland textbook prompts; use a tiny real-life situation or a concrete mini-context when possible.

JSON shape:
{"prompt":"","passage":"","choices":[],"correctAnswer":"","acceptedAnswers":[],"productionRubric":"","topics":[],"itemFamily":""}`;
}

function validateGeneratedPlacementItem(
  value: unknown,
  params: PlacementItemGenerationParams
): GeneratedPlacementItemPayload {
  const record = value as Record<string, unknown>;
  const language = normalizeLanguageCode(params.language, "en");
  const nativeLanguage = normalizeLanguageCode(params.nativeLanguage, "ru");
  const difficulty = Math.max(1, Math.min(6, Math.round(params.difficulty)));
  const type = getPlacementType(params.skill, language);
  const cefrLevel = getPlacementLevel(difficulty);
  const prompt = cleanText(record.prompt);
  const passage = cleanText(record.passage);
  const correctAnswer = cleanText(record.correctAnswer);
  const choices = type === "short_production"
    ? []
    : normalizeChoiceOptions(
        cleanUniqueStringArray(record.choices, 8),
        correctAnswer,
        `${params.seed}|${params.skill}|${params.answeredCount}|placement`,
        4
      );
  const acceptedAnswers = type === "short_production"
    ? []
    : ensureOptionIncluded(cleanUniqueStringArray(record.acceptedAnswers, 6), correctAnswer, 6);
  const productionRubric = cleanText(record.productionRubric);
  const topics = cleanUniqueStringArray(record.topics, 5);
  const itemFamilyBase = cleanText(record.itemFamily) || `${language}_${params.skill}_${cefrLevel}_${difficulty}`;
  const itemFamily = itemFamilyBase
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!prompt) throw new Error("Generated placement item is missing prompt");
  if (type !== "short_production" && (!correctAnswer || choices.length !== 4)) {
    throw new Error("Generated placement item needs four choices and a correct answer");
  }
  if (type === "reading_comprehension" && !passage) {
    throw new Error("Generated reading placement item is missing passage");
  }
  if (type === "short_production" && !productionRubric) {
    throw new Error("Generated production placement item is missing rubric");
  }

  return {
    itemKey: `ai:${language}:${params.skill}:${difficulty}:${hashText(
      [params.seed, params.answeredCount, prompt, correctAnswer].join("|"),
      20
    )}`,
    language,
    nativeLanguage,
    type,
    skill: params.skill,
    cefrLevel,
    difficulty,
    scriptStage: getPlacementScriptStage(language, difficulty),
    prompt,
    passage: passage || undefined,
    choices,
    correctAnswer: correctAnswer || undefined,
    acceptedAnswers,
    productionRubric: productionRubric || undefined,
    topics: topics.length ? topics : ["daily life"],
    itemFamily,
    variants: [],
  };
}

export async function generatePlacementItemWithAi(
  params: PlacementItemGenerationParams
): Promise<GeneratedPlacementItemPayload> {
  if (!isAiConfigured()) throw new Error("AI service not configured");

  return requestJsonWithRetry(
    (attempt, previousError) =>
      `${buildPlacementPrompt(params)}\n\n${
        attempt > 1 ? `Previous attempt failed: ${previousError}. Return valid strict JSON only.` : ""
      }`,
    (value) => validateGeneratedPlacementItem(value, params)
  );
}

export async function generateQuiz(
  userId: string,
  level: CefrLevel,
  studyLanguage: string,
  nativeLanguage: string
): Promise<QuizQuestion[]> {
  const learningContext = await buildLearningContext(userId);
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const effectiveLevel = learningContext.level ?? level;
  const userWords = await UserWord.find({
    userId,
    status: { $in: ["SAVED", "LEARNING", "DIFFICULT", "NEW"] },
  })
    .sort({ nextReviewAt: 1, updatedAt: 1 })
    .populate({ path: "wordId", match: AI_SOURCE_FILTER })
    .lean({ virtuals: true });

  const words = userWords
    .map((record) => record.wordId as unknown)
    .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null)
    .filter((word) => word.language === targetLanguage && word.nativeLanguage === sourceLanguage)
    .slice(0, 24)
    .map((word) => asVocabularyWord(word));

  return generateQuizFromWords({
    userId,
    level: effectiveLevel,
    studyLanguage: targetLanguage,
    nativeLanguage: sourceLanguage,
    words,
  });
}

export async function generateDiscoverQuiz(
  userId: string,
  level: CefrLevel,
  studyLanguage: string,
  nativeLanguage: string
): Promise<QuizQuestion[]> {
  const learningContext = await buildLearningContext(userId);
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const effectiveLevel = learningContext.level ?? level;
  const { recentWordIds } = await getRecentHistory(userId, targetLanguage, sourceLanguage);
  const existingWordDocs = await UserWord.find({ userId }).select("wordId").lean();
  const excludedIds = [...new Set([...existingWordDocs.map((doc) => String(doc.wordId)), ...recentWordIds])];

  let words = await VocabularyWord.find({
    ...AI_SOURCE_FILTER,
    language: targetLanguage,
    nativeLanguage: sourceLanguage,
    cefrLevel: effectiveLevel,
    _id: { $nin: excludedIds },
    ...(learningContext.interests.length > 0
      ? { topic: { $in: learningContext.interests.map((item) => normalizeTopic(item)) } }
      : {}),
  })
    .sort({ progressionStep: 1, createdAt: 1 })
    .limit(24)
    .lean({ virtuals: true }) as unknown as IVocabularyWord[];

  let focusTopic = getPrimaryTopic(words);

  if (pickQuizTopicWords(words, 10).length < QUESTION_TARGET_COUNT && isAiConfigured()) {
    try {
      await generateAndSaveWords({
        level: effectiveLevel,
        targetLanguage,
        nativeLanguage: sourceLanguage,
        topic: focusTopic ?? learningContext.interests[0],
        count: 16,
      });
      words = await VocabularyWord.find({
        ...AI_SOURCE_FILTER,
        language: targetLanguage,
        nativeLanguage: sourceLanguage,
        cefrLevel: effectiveLevel,
        _id: { $nin: excludedIds },
        ...(focusTopic ? { topic: focusTopic } : {}),
      })
        .sort({ progressionStep: 1, createdAt: 1 })
        .limit(24)
        .lean({ virtuals: true }) as unknown as IVocabularyWord[];
      focusTopic = getPrimaryTopic(words) ?? focusTopic;
    } catch (error) {
      logger.warn(`Discover generation failed: ${error}`);
    }
  }

  return generateQuizFromWords({
    userId,
    level: effectiveLevel,
    studyLanguage: targetLanguage,
    nativeLanguage: sourceLanguage,
    words: words.map((word) => asVocabularyWord(word as unknown as Record<string, unknown>)),
    includeWordInfo: true,
  });
}

type EvaluatableQuizQuestion = Pick<QuizQuestion, "type" | "wordId"> & Record<string, unknown>;

const OPEN_EVALUATION_TYPES = new Set<QuizQuestionType>([
  "translation_input",
  "sentence_writing",
  "error_correction",
  "open_translation",
  "translation_variants",
  "short_paragraph_response",
  "summary",
  "argument_response",
  "essay_writing",
]);

function isVirtualWordId(wordId: string) {
  return wordId.startsWith("lesson:") || wordId.startsWith("media:");
}

async function getOptionalWordForQuestion(
  question: EvaluatableQuizQuestion,
  targetLanguage: string,
  sourceLanguage: string
): Promise<IVocabularyWord | undefined> {
  const wordId = cleanText(question.wordId);
  if (!wordId || isVirtualWordId(wordId)) return undefined;

  try {
    return asVocabularyWord(
      (await getWordForPair(wordId, targetLanguage, sourceLanguage)) as unknown as Record<string, unknown>
    );
  } catch (error) {
    logger.warn(`Could not load quiz word ${wordId} for evaluation: ${error}`);
    return undefined;
  }
}

function getQuestionAcceptedAnswers(question: EvaluatableQuizQuestion, fallback?: string) {
  return ensureOptionIncluded(cleanUniqueStringArray(question.acceptedAnswers, 8), fallback, 8);
}

function getQuestionCorrectAnswer(
  question: EvaluatableQuizQuestion,
  word: IVocabularyWord | undefined,
  level: CefrLevel
) {
  const explicit = cleanText(question.correctAnswer);
  if (explicit) return explicit;
  const sample = cleanText(question.sampleAnswer);

  switch (question.type) {
    case "multiple_choice":
      return word ? (level === "A1" || level === "A2" || level === "B1" ? word.translation : word.definition) : "";
    case "fill_blank":
    case "reverse_multiple_choice":
    case "image_based":
    case "word_to_picture":
    case "picture_to_word":
    case "choose_missing_word":
    case "fill_in_context":
    case "script_recognition":
    case "reading_association":
    case "short_dictation":
      return word?.word ?? "";
    case "tap_translation":
      return word?.translation ?? "";
    case "sentence_writing":
      return cleanText(question.targetWord) || word?.word || "";
    case "open_translation":
    case "translation_variants":
    case "summary":
      return sample;
    default:
      return "";
  }
}

function parseMatchingPairs(value: string): Array<{ left: string; right: string }> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const record = item as Record<string, unknown>;
        const left = cleanText(record.left);
        const right = cleanText(record.right);
        return left && right ? { left, right } : null;
      })
      .filter((item): item is { left: string; right: string } => Boolean(item));
  } catch {
    return [];
  }
}

function evaluateMatchingAnswer(question: EvaluatableQuizQuestion, answer: string): QuizAnswerEvaluation {
  const expectedPairs = parseMatchingPairs(cleanText(question.correctAnswer));
  const answerPairs = parseMatchingPairs(answer);
  const expected = new Map(expectedPairs.map((pair) => [normalizeAnswer(pair.left), normalizeAnswer(pair.right)]));
  const correct =
    expected.size > 0 &&
    answerPairs.length === expected.size &&
    answerPairs.every((pair) => expected.get(normalizeAnswer(pair.left)) === normalizeAnswer(pair.right));

  return {
    questionType: "matching",
    status: statusFromCorrect(correct),
    correct,
    feedback: correct ? "All pairs match." : "Some pairs do not match yet.",
    correctAnswer: expectedPairs.map((pair) => `${pair.left} = ${pair.right}`).join("; "),
    hasMistakes: !correct,
  };
}

function buildOpenFallbackEvaluation(params: {
  question: EvaluatableQuizQuestion;
  answer: string;
  correctAnswer?: string;
  acceptedAnswers?: string[];
}): QuizAnswerEvaluation {
  const minWords = coerceNumber(params.question.minWords, 8, 1, 220);
  const wordCount = normalizeAnswer(params.answer).split(" ").filter(Boolean).length;
  const acceptedAnswers = params.acceptedAnswers?.length
    ? params.acceptedAnswers
    : getQuestionAcceptedAnswers(params.question, params.correctAnswer);
  const directMatch = acceptedAnswers.some((item) => normalizeAnswer(item) === normalizeAnswer(params.answer));
  const exactOpenTypes = new Set<QuizQuestionType>([
    "translation_input",
    "error_correction",
    "open_translation",
    "translation_variants",
  ]);
  const correct = exactOpenTypes.has(params.question.type) && directMatch;

  return {
    questionType: params.question.type,
    status: correct ? "correct" : "pending_review",
    correct,
    feedback: correct
      ? "The answer matches the saved expected answer."
      : "Your answer was received. Automatic review is temporarily unavailable, so this response will not reduce your progress.",
    correctAnswer: params.correctAnswer,
    hasMistakes: false,
    ruleChecks: cleanStringArray(params.question.rubric, 6).map((rule) => ({
      label: rule,
      passed: false,
      detail:
        wordCount >= minWords
          ? "The response has enough length, but AI review is still required."
          : `The response is also shorter than the suggested minimum of ${minWords} words.`,
    })),
  };
}

async function evaluateOpenRoadmapAnswer(params: {
  level: CefrLevel;
  question: EvaluatableQuizQuestion;
  answer: string;
  word?: IVocabularyWord;
  targetLanguage: string;
  nativeLanguage: string;
  correctAnswer?: string;
  acceptedAnswers?: string[];
}): Promise<QuizAnswerEvaluation> {
  const fallback = buildOpenFallbackEvaluation({
    question: params.question,
    answer: params.answer,
    correctAnswer: params.correctAnswer,
    acceptedAnswers: params.acceptedAnswers,
  });

  if (!isAiConfigured()) return fallback;

  const explanationLanguage = getExplanationLanguageCode(
    params.level,
    params.nativeLanguage,
    params.targetLanguage
  );
  const rubric = cleanStringArray(params.question.rubric, 6);

  try {
    return await requestJsonWithRetry(
      () => `You evaluate a language-learning exercise answer. Strict JSON only.

Explain feedback in ${getLanguageName(explanationLanguage)}.
Study language: ${getLanguageName(params.targetLanguage)} (${params.targetLanguage}).
Learner native language: ${getLanguageName(params.nativeLanguage)} (${params.nativeLanguage}).
CEFR level: ${params.level}.
Exercise type: ${params.question.type}.
Question: "${cleanText(params.question.question)}"
Prompt text: "${cleanText(params.question.promptText)}"
Prompt: "${cleanText(params.question.prompt)}"
Sentence: "${cleanText(params.question.sentence)}"
Passage: "${cleanText(params.question.passage)}"
Transcript with blank: "${cleanText(params.question.transcriptWithBlank)}"
Target word: "${cleanText(params.question.targetWord) || params.word?.word || ""}"
Word meaning: "${params.word ? `${params.word.word} = ${params.word.translation}; ${params.word.definition}` : ""}"
Expected answer or sample: "${cleanText(params.correctAnswer) || cleanText(params.question.sampleAnswer)}"
Accepted answers: ${JSON.stringify(params.acceptedAnswers ?? [])}
Rubric: ${JSON.stringify(rubric)}
Minimum words: ${coerceNumber(params.question.minWords, 1, 1, 220)}
User answer: "${cleanText(params.answer)}"

Rules:
- For translations, mark correct=true when the meaning is natural and equivalent, even with different wording, inflection, articles, plurality, or close synonyms.
- For error correction, mark correct=true when the corrected sentence fixes the main error and remains natural.
- For writing, grade by the rubric and learner level. Minor mistakes can still be correct if the answer satisfies the task.
- Mark correct=false when meaning is wrong, too vague, in the wrong language, or the required task is not attempted.
- Keep feedback short and actionable.
- Return up to 5 ruleChecks.

{"correct":true,"feedback":"","correctAnswer":"${cleanText(params.correctAnswer)}","acceptedEquivalent":"","hasMistakes":false,"correctedAnswer":"","ruleChecks":[{"label":"","passed":true,"detail":""}]}`,
      (value) => validateQuizAnswerEvaluation(value, params.question.type)
    );
  } catch (error) {
    logger.warn(`AI open answer evaluation failed: ${error}`);
    return fallback;
  }
}

export async function evaluateQuizAnswer(params: {
  level: CefrLevel;
  studyLanguage: string;
  nativeLanguage: string;
  question: EvaluatableQuizQuestion;
  answer: string;
}): Promise<QuizAnswerEvaluation> {
  const targetLanguage = normalizeLanguageCode(params.studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(params.nativeLanguage, "ru");
  const answer = cleanText(params.answer);

  if (!answer) {
    throw new AppError("Answer is required", 400);
  }

  const word = await getOptionalWordForQuestion(params.question, targetLanguage, sourceLanguage);
  const correctAnswer = getQuestionCorrectAnswer(params.question, word, params.level);
  const acceptedAnswers = getQuestionAcceptedAnswers(params.question, correctAnswer);

  if (params.question.type === "matching") {
    return evaluateMatchingAnswer(params.question, answer);
  }

  if (OPEN_EVALUATION_TYPES.has(params.question.type)) {
    if (params.question.type === "translation_input" && word) {
      return evaluateTranslationAnswer({
        level: params.level,
        answer,
        word,
        targetLanguage,
        nativeLanguage: sourceLanguage,
      });
    }

    if (params.question.type === "sentence_writing" && word) {
      return evaluateSentenceAnswer({
        level: params.level,
        answer,
        targetWord: cleanText(params.question.targetWord) || cleanText(word.word),
        minWords:
          typeof params.question.minWords === "number" && Number.isFinite(params.question.minWords)
            ? params.question.minWords
            : params.level === "B1"
                ? 5
                : 7,
        word,
        targetLanguage,
        nativeLanguage: sourceLanguage,
      });
    }

    return evaluateOpenRoadmapAnswer({
      level: params.level,
      question: params.question,
      answer,
      word,
      targetLanguage,
      nativeLanguage: sourceLanguage,
      correctAnswer,
      acceptedAnswers,
    });
  }

  if (!correctAnswer) {
    throw new AppError("Unsupported quiz question type", 400);
  }

  switch (params.question.type) {
    case "multiple_choice":
    case "fill_blank":
    case "reverse_multiple_choice":
    case "image_based":
    case "word_to_picture":
    case "picture_to_word":
    case "tap_translation":
    case "tap_heard_phrase":
    case "reorder_words":
    case "choose_missing_word":
    case "script_recognition":
    case "reading_association":
    case "fill_in_context":
    case "paraphrase_choice":
    case "short_dictation":
    case "transcript_gap_fill":
    case "reading_comprehension":
    case "media_transcript":
    case "media_comprehension":
      return buildExactMatchEvaluation({
        questionType: params.question.type,
        answer,
        correctAnswer,
        acceptedAnswers,
        correctFeedback: "Nice work.",
        incorrectFeedback: "Not quite. The correct answer is shown below.",
      });
    default:
      throw new Error("Unsupported quiz question type");
  }
}

export async function getSimilarWords(
  wordId: string,
  level: CefrLevel,
  studyLanguage: string,
  nativeLanguage: string
): Promise<IVocabularyWord[]> {
  const targetLanguage = normalizeLanguageCode(studyLanguage, "en");
  const sourceLanguage = normalizeLanguageCode(nativeLanguage, "ru");
  const word = await getWordForPair(wordId, targetLanguage, sourceLanguage);

  if (word.synonyms.length > 0) {
    const similar = await VocabularyWord.find({
      ...AI_SOURCE_FILTER,
      word: { $in: word.synonyms },
      language: targetLanguage,
      nativeLanguage: sourceLanguage,
      cefrLevel: level,
    })
      .limit(4)
      .lean({ virtuals: true }) as unknown as IVocabularyWord[];
    if (similar.length > 0) {
      return similar.map((item) => asVocabularyWord(item as unknown as Record<string, unknown>));
    }
  }

  if (!isAiConfigured()) return [];

  try {
    const suggestions = await requestJsonWithRetry(
      () => `4 words related to "${word.word}" in ${getLanguageName(targetLanguage)}, level=${level}. Strict JSON array only: ["","","",""]`,
      (value) => cleanStringArray(value, 4)
    );

    const similar = await VocabularyWord.find({
      ...AI_SOURCE_FILTER,
      word: { $in: suggestions },
      language: targetLanguage,
      nativeLanguage: sourceLanguage,
    })
      .limit(4)
      .lean({ virtuals: true }) as unknown as IVocabularyWord[];

    return similar.map((item) => asVocabularyWord(item as unknown as Record<string, unknown>));
  } catch (error) {
    logger.warn(`AI similar words failed: ${error}`);
    return [];
  }
}
