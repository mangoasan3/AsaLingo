import {
  buildFallbackFillBlankSentence,
  isMeaningfulFillBlankSentence,
  isSuspiciousPromptTranslation,
  pickFillBlankSentence,
  pickPromptTranslation,
} from "../modules/ai/questionQuality";
import {
  DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID,
  buildYoutubeRuntimeSourceUrl,
} from "../utils/youtube";

describe("question quality helpers", () => {
  test("rejects empty fill-blank shells", () => {
    expect(isMeaningfulFillBlankSentence("_____.")).toBe(false);
  });

  test("accepts fill-blank sentences with real context", () => {
    expect(isMeaningfulFillBlankSentence("I need to _____ the plan before lunch.")).toBe(true);
  });

  test("builds a fallback blank from the example sentence", () => {
    expect(buildFallbackFillBlankSentence("We plan the trip together.", "plan")).toBe(
      "We _____ the trip together."
    );
  });

  test("replaces an unusable AI fill-blank sentence with the example sentence", () => {
    expect(
      pickFillBlankSentence("_____.", "plan", "We plan the trip together.")
    ).toBe("We _____ the trip together.");
  });

  test("flags meta prompt translations like improve meaning", () => {
    expect(isSuspiciousPromptTranslation("improve meaning")).toBe(true);
  });

  test("falls back to the stored translation when the AI prompt translation is suspicious", () => {
    expect(pickPromptTranslation("improve meaning", "улучшать")).toBe("улучшать");
  });
});

describe("youtube url helper", () => {
  test("buildYoutubeRuntimeSourceUrl returns the fallback watch URL", () => {
    expect(buildYoutubeRuntimeSourceUrl()).toBe(
      `https://www.youtube.com/watch?v=${DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID}`
    );
  });

  test("DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID is the known constant — not injected into runtime quizzes", () => {
    // buildRuntimeQuizMediaTask was changed to always return null so this video
    // no longer appears as a media placeholder in generated quiz sessions.
    // This test documents the constant value so any accidental reuse is visible.
    expect(DEFAULT_YOUTUBE_FALLBACK_VIDEO_ID).toBe("M7lc1UVf-VE");
  });
});
