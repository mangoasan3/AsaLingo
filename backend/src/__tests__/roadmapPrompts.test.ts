import {
  getGuidedWritingTexts,
  getMediaExercisePrompt,
  getOpenTranslationTexts,
  getSentenceWritingPrompt,
} from "../modules/ai/roadmapPrompts";

describe("roadmap prompt localization", () => {
  test("uses native-language wording for sentence-writing prompts", () => {
    expect(getSentenceWritingPrompt("ru", "план")).toBe(
      "Напишите короткое предложение со словом «план»."
    );
  });

  test("uses native-language wording for media transcript prompts", () => {
    expect(getMediaExercisePrompt("transcript_gap_fill", "ru")).toBe(
      "Посмотрите фрагмент и выберите пропущенное слово."
    );
    expect(getMediaExercisePrompt("media_transcript", "ru")).toBe(
      "Посмотрите фрагмент и напишите пропущенное слово."
    );
  });

  test("keeps translation exercises in the learner native language", () => {
    const translation = getOpenTranslationTexts("open_translation", "ru", {
      sentence: "I study every evening.",
    });
    const variants = getOpenTranslationTexts("translation_variants", "ru", {
      word: "improve",
    });

    expect(translation.question).toBe("Переведите предложение.");
    expect(translation.prompt).toContain("Переведите это предложение естественно");
    expect(variants.question).toBe("Дайте естественный перевод.");
    expect(variants.prompt).toContain("естественный перевод слова");
  });

  test("localizes guided writing prompts for Russian native language", () => {
    const writing = getGuidedWritingTexts("short_paragraph_response", "ru", {
      topic: "travel",
      word: "route",
    });

    expect(writing.question).toBe("Напишите короткий абзац.");
    expect(writing.prompt).toContain("Напишите короткий абзац");
    expect(writing.rubric[0]).toBe("Тема раскрыта ясно");
  });
});
