import {
  buildSentenceWritingSupport,
  cleanGeneratedExerciseStringArray,
  cleanGeneratedExerciseText,
  isGeneratedPlaceholderText,
  toPublicQuizQuestion,
} from "../modules/ai/ai.quiz.service";

describe("sentence writing support", () => {
  test("fills empty generated conditions with usable defaults", () => {
    const support = buildSentenceWritingSupport({
      level: "B1",
      targetWord: "nourriture",
      word: {
        word: "nourriture",
        translation: "food",
        topic: "daily life",
        collocations: [],
        exampleSentence: "Je cherche de la nourriture.",
      } as never,
      keywordHints: [],
      instructions: [],
      helpfulTips: [],
    });

    expect(support.minWords).toBe(5);
    expect(support.keywordHints.length).toBeGreaterThan(0);
    expect(support.instructions).toEqual([
      "Write in the language you are studying.",
      'Use "nourriture" naturally in your sentence.',
      "Write at least 5 words.",
    ]);
    expect(support.helpfulTips.length).toBeGreaterThan(0);
  });

  test("does not surface suspicious meaning placeholders as helpful tips", () => {
    const support = buildSentenceWritingSupport({
      level: "B2",
      targetWord: "nourriture",
      word: {
        word: "nourriture",
        translation: "nourriture meaning",
        topic: "",
        collocations: [],
        exampleSentence: "",
      } as never,
    });

    expect(support.helpfulTips.join(" ")).not.toMatch(/\bnourriture meaning\b/i);
    expect(support.helpfulTips.length).toBeGreaterThan(0);
  });

  test("filters target-word placeholder pairs from generated support fields", () => {
    const word = {
      word: "nourriture",
      translation: "food",
      topic: "food",
      collocations: [],
      exampleSentence: "",
    } as never;
    const support = buildSentenceWritingSupport({
      level: "B2",
      targetWord: "nourriture",
      word,
      keywordHints: ["nourriture food", "daily life"],
      instructions: ["nourriture meaning", 'Use "nourriture" naturally.'],
      helpfulTips: ["nourriture: food", "Keep it natural."],
    });

    const combined = [
      ...support.keywordHints,
      ...support.instructions,
      ...support.helpfulTips,
    ].join(" ");

    expect(combined).not.toMatch(/\bnourriture (meaning|food)\b/i);
    expect(support.keywordHints).toContain("daily life");
    expect(support.instructions).toContain('Use "nourriture" naturally.');
    expect(support.helpfulTips).toContain("Keep it natural.");
  });

  test("detects and removes generated word-plus-translation placeholders", () => {
    const word = { word: "nourriture", translation: "food" };

    expect(isGeneratedPlaceholderText("nourriture meaning", word)).toBe(true);
    expect(isGeneratedPlaceholderText("nourriture: food", word)).toBe(true);
    expect(cleanGeneratedExerciseText("nourriture food", word)).toBe("");
    expect(cleanGeneratedExerciseStringArray(["nourriture food", "daily life"], word)).toEqual([
      "daily life",
    ]);
  });

  test("sanitizes placeholders when exposing cached public questions", () => {
    const question = toPublicQuizQuestion({
      type: "sentence_writing",
      question: "nourriture meaning",
      wordId: "word-1",
      questionHash: "hash-1",
      wordInfo: {
        word: "nourriture",
        translation: "food",
        definition: "food",
        exampleSentence: "Je cherche de la nourriture.",
      },
      targetWord: "nourriture",
      minWords: 7,
      keywordHints: ["nourriture food", "daily life"],
      instructions: ["nourriture: food", 'Use "nourriture" naturally.'],
      helpfulTips: ["nourriture meaning", "Keep it natural."],
      sampleAnswer: "Je cherche de la nourriture.",
    });

    const sentenceQuestion = question as typeof question & {
      keywordHints: string[];
      instructions: string[];
      helpfulTips: string[];
    };

    expect(sentenceQuestion.question).toBe("Sentence writing");
    expect(sentenceQuestion.keywordHints).toEqual(["daily life"]);
    expect(sentenceQuestion.instructions).toEqual(['Use "nourriture" naturally.']);
    expect(sentenceQuestion.helpfulTips).toEqual(["Keep it natural."]);
    expect("sampleAnswer" in sentenceQuestion).toBe(false);
  });
});
