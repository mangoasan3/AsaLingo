import { normalizeLanguageCode } from "../../utils/language";
import type { ExerciseType } from "../learning/exerciseCatalog";

type PromptLanguage = "en" | "ru";

function pickPromptLanguage(nativeLanguage: string): PromptLanguage {
  return normalizeLanguageCode(nativeLanguage, "en") === "ru" ? "ru" : "en";
}

export function getSentenceWritingPrompt(nativeLanguage: string, word: string): string {
  return pickPromptLanguage(nativeLanguage) === "ru"
    ? `\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0441\u043e \u0441\u043b\u043e\u0432\u043e\u043c \u00ab${word}\u00bb.`
    : `Write a short sentence using "${word}".`;
}

export function getScriptExercisePrompt(
  type: "script_recognition" | "reading_association",
  nativeLanguage: string
): string {
  const language = pickPromptLanguage(nativeLanguage);
  if (type === "script_recognition") {
    return language === "ru"
      ? "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e\u0435 \u0447\u0442\u0435\u043d\u0438\u0435."
      : "Choose the correct reading.";
  }

  return language === "ru"
    ? "\u0421\u043e\u043e\u0442\u043d\u0435\u0441\u0438\u0442\u0435 \u0441\u043b\u043e\u0432\u043e \u0441 \u0435\u0433\u043e \u0447\u0442\u0435\u043d\u0438\u0435\u043c."
    : "Match the word to its reading.";
}

export function getMediaExercisePrompt(
  type: "transcript_gap_fill" | "media_transcript",
  nativeLanguage: string
): string {
  const language = pickPromptLanguage(nativeLanguage);
  if (type === "transcript_gap_fill") {
    return language === "ru"
      ? "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u0444\u0440\u0430\u0433\u043c\u0435\u043d\u0442 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043d\u043e\u0435 \u0441\u043b\u043e\u0432\u043e."
      : "Watch the clip and choose the missing word.";
  }

  return language === "ru"
    ? "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u0444\u0440\u0430\u0433\u043c\u0435\u043d\u0442 \u0438 \u043d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043d\u043e\u0435 \u0441\u043b\u043e\u0432\u043e."
    : "Watch the clip and type the missing word.";
}

export function getMediaComprehensionPrompt(nativeLanguage: string): string {
  return pickPromptLanguage(nativeLanguage) === "ru"
    ? "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u0444\u0440\u0430\u0433\u043c\u0435\u043d\u0442 \u0438 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442."
    : "Watch the clip and choose the correct answer.";
}

export function getOpenTranslationTexts(
  type: "open_translation" | "translation_variants",
  nativeLanguage: string,
  params: { sentence?: string; word?: string }
): { question: string; prompt: string; rubric: string[] } {
  const language = pickPromptLanguage(nativeLanguage);
  if (type === "open_translation") {
    return language === "ru"
      ? {
          question: "\u041f\u0435\u0440\u0435\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435.",
          prompt: `\u041f\u0435\u0440\u0435\u0432\u0435\u0434\u0438\u0442\u0435 \u044d\u0442\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e: ${params.sentence ?? ""}`.trim(),
          rubric: [
            "\u0421\u043c\u044b\u0441\u043b \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d",
            "\u0424\u043e\u0440\u043c\u0443\u043b\u0438\u0440\u043e\u0432\u043a\u0430 \u0437\u0432\u0443\u0447\u0438\u0442 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e",
            "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d \u043d\u0443\u0436\u043d\u044b\u0439 \u044f\u0437\u044b\u043a",
          ],
        }
      : {
          question: "Translate the sentence.",
          prompt: `Translate this sentence naturally: ${params.sentence ?? ""}`.trim(),
          rubric: ["Meaning is preserved", "Natural wording", "Correct language"],
        };
  }

  return language === "ru"
    ? {
        question: "\u0414\u0430\u0439\u0442\u0435 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434.",
        prompt: `\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434 \u0441\u043b\u043e\u0432\u0430 \u00ab${params.word ?? ""}\u00bb \u0438 \u043e\u0434\u0438\u043d \u0431\u043b\u0438\u0437\u043a\u0438\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442.`.trim(),
        rubric: [
          "\u0421\u043c\u044b\u0441\u043b \u043f\u0435\u0440\u0435\u0434\u0430\u043d \u0442\u043e\u0447\u043d\u043e",
          "\u0424\u043e\u0440\u043c\u0443\u043b\u0438\u0440\u043e\u0432\u043a\u0430 \u0437\u0432\u0443\u0447\u0438\u0442 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e",
          "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d \u043d\u0443\u0436\u043d\u044b\u0439 \u044f\u0437\u044b\u043a",
        ],
      }
    : {
        question: "Give a natural translation.",
        prompt: `Write a natural translation for "${params.word ?? ""}" and one close variant.`.trim(),
        rubric: ["Meaning is preserved", "Natural wording", "Correct language"],
      };
}

export function getErrorCorrectionPrompt(nativeLanguage: string): string {
  return pickPromptLanguage(nativeLanguage) === "ru"
    ? "\u0418\u0441\u043f\u0440\u0430\u0432\u044c\u0442\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435."
    : "Correct the sentence.";
}

export function getGuidedWritingTexts(
  type: "short_paragraph_response" | "summary" | "argument_response" | "essay_writing",
  nativeLanguage: string,
  params: { topic?: string; word?: string; passage?: string }
): { question: string; prompt: string; rubric: string[] } {
  const language = pickPromptLanguage(nativeLanguage);
  const topic = params.topic ?? "daily life";
  const word = params.word ?? "";
  const passage = params.passage ?? "";

  switch (type) {
    case "short_paragraph_response":
      return language === "ru"
        ? {
            question: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u0430\u0431\u0437\u0430\u0446.",
            prompt: `\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u0430\u0431\u0437\u0430\u0446 \u043e \u0442\u0435\u043c\u0435 ${topic}. \u0415\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u00ab${word}\u00bb.`.trim(),
            rubric: [
              "\u0422\u0435\u043c\u0430 \u0440\u0430\u0441\u043a\u0440\u044b\u0442\u0430 \u044f\u0441\u043d\u043e",
              "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0430 \u0446\u0435\u043b\u0435\u0432\u0430\u044f \u043b\u0435\u043a\u0441\u0438\u043a\u0430",
              "\u0413\u0440\u0430\u043c\u043c\u0430\u0442\u0438\u043a\u0430 \u0437\u0432\u0443\u0447\u0438\u0442 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e",
              "\u0414\u0435\u0442\u0430\u043b\u0435\u0439 \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e",
            ],
          }
        : {
            question: "Write a short paragraph.",
            prompt: `Write a short paragraph about ${topic}. Use "${word}" naturally.`.trim(),
            rubric: ["Clear topic", "Uses target vocabulary", "Natural grammar", "Enough detail"],
          };
    case "summary":
      return language === "ru"
        ? {
            question: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u0440\u0430\u0442\u043a\u043e\u0435 \u0440\u0435\u0437\u044e\u043c\u0435.",
            prompt: `\u041f\u0435\u0440\u0435\u0441\u043a\u0430\u0436\u0438\u0442\u0435 \u044d\u0442\u0443 \u0438\u0434\u0435\u044e \u0441\u0432\u043e\u0438\u043c\u0438 \u0441\u043b\u043e\u0432\u0430\u043c\u0438: ${passage}`.trim(),
            rubric: [
              "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d \u0433\u043b\u0430\u0432\u043d\u044b\u0439 \u0441\u043c\u044b\u0441\u043b",
              "\u0424\u043e\u0440\u043c\u0443\u043b\u0438\u0440\u043e\u0432\u043a\u0430 \u043a\u0440\u0430\u0442\u043a\u0430\u044f \u0438 \u044f\u0441\u043d\u0430\u044f",
              "\u041d\u0435\u0442 \u0432\u044b\u043c\u044b\u0448\u043b\u0435\u043d\u043d\u044b\u0445 \u0434\u0435\u0442\u0430\u043b\u0435\u0439",
            ],
          }
        : {
            question: "Write a short summary.",
            prompt: `Summarize this idea in your own words: ${passage}`.trim(),
            rubric: ["Keeps the main meaning", "Uses concise wording", "No invented details"],
          };
    case "argument_response":
      return language === "ru"
        ? {
            question: "\u0414\u0430\u0439\u0442\u0435 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0435 \u043c\u043d\u0435\u043d\u0438\u0435.",
            prompt: `\u0412\u044b\u0441\u043a\u0430\u0436\u0438\u0442\u0435 \u0441\u0432\u043e\u0435 \u043c\u043d\u0435\u043d\u0438\u0435: ${topic} \u0432\u0430\u0436\u043d\u0430 \u0434\u043b\u044f \u043f\u043e\u0432\u0441\u0435\u0434\u043d\u0435\u0432\u043d\u043e\u0439 \u0436\u0438\u0437\u043d\u0438. \u041f\u0440\u0438\u0432\u0435\u0434\u0438\u0442\u0435 \u043f\u0440\u0438\u043c\u0435\u0440\u044b \u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u00ab${word}\u00bb, \u0435\u0441\u043b\u0438 \u044d\u0442\u043e \u0437\u0432\u0443\u0447\u0438\u0442 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e.`.trim(),
            rubric: [
              "\u041f\u043e\u0437\u0438\u0446\u0438\u044f \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0430 \u044f\u0441\u043d\u043e",
              "\u0415\u0441\u0442\u044c \u043f\u0440\u0438\u0447\u0438\u043d\u0430 \u0438\u043b\u0438 \u043f\u0440\u0438\u043c\u0435\u0440",
              "\u041c\u044b\u0441\u043b\u0438 \u0441\u0432\u044f\u0437\u0430\u043d\u044b \u043b\u043e\u0433\u0438\u0447\u043d\u043e",
              "\u042f\u0437\u044b\u043a \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0443\u0440\u043e\u0432\u043d\u044e",
            ],
          }
        : {
            question: "Give a supported opinion.",
            prompt: `Give your opinion: ${topic} is important for everyday life. Use examples and include "${word}" if it fits naturally.`.trim(),
            rubric: ["Clear opinion", "Reason or example", "Logical connection", "Level-appropriate language"],
          };
    case "essay_writing":
      return language === "ru"
        ? {
            question: "\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u043d\u043e\u0435 \u044d\u0441\u0441\u0435.",
            prompt: `\u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u044d\u0441\u0441\u0435 \u043e \u0442\u0435\u043c\u0435 ${topic}: \u043a\u0440\u0430\u0442\u043a\u043e \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043c\u0443, \u043f\u0440\u0438\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0432\u0430 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u0430 \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0432\u044b\u0432\u043e\u0434\u043e\u043c.`.trim(),
            rubric: [
              "\u0415\u0441\u0442\u044c \u0432\u0441\u0442\u0443\u043f\u043b\u0435\u043d\u0438\u0435",
              "\u0415\u0441\u0442\u044c \u0434\u0432\u0430 \u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044b\u0445 \u043f\u0443\u043d\u043a\u0442\u0430",
              "\u0415\u0441\u0442\u044c \u0437\u0430\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435",
              "\u042f\u0437\u044b\u043a \u0442\u043e\u0447\u043d\u044b\u0439 \u0438 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0439",
            ],
          }
        : {
            question: "Write a structured short essay.",
            prompt: `Write a short essay about ${topic}: introduce the topic, give two points, and finish with a conclusion.`.trim(),
            rubric: ["Introduction", "Two developed points", "Conclusion", "Accurate language"],
          };
  }
}

export function isLocalizedRoadmapExercise(type: ExerciseType): boolean {
  return [
    "sentence_writing",
    "script_recognition",
    "reading_association",
    "open_translation",
    "translation_variants",
    "error_correction",
    "transcript_gap_fill",
    "media_transcript",
    "short_paragraph_response",
    "summary",
    "argument_response",
    "essay_writing",
  ].includes(type);
}
