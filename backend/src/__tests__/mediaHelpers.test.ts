import {
  buildImageUrl,
  getMediaBlank,
  isDisallowedPlaceholderImageUrl,
  isImageFriendlyWord,
} from "../modules/ai/mediaHelpers";

describe("media helpers", () => {
  test("uses curated images instead of loremflickr placeholders", () => {
    const word = {
      id: "word-eau",
      word: "eau",
      translation: "water",
      definition: "water",
      partOfSpeech: "NOUN",
      topic: "gaming",
      exampleSentence: "Je bois de l'eau.",
      collocations: [],
      synonyms: [],
      progressionStep: 1,
    } as Parameters<typeof buildImageUrl>[0];

    expect(isImageFriendlyWord(word)).toBe(true);
    expect(buildImageUrl(word)).toContain("data:image/svg+xml");
    expect(buildImageUrl(word)).toContain("%26%23x1F4A7%3B");
    expect(buildImageUrl(word)).not.toContain("loremflickr.com");
  });

  test("detects image placeholder services", () => {
    expect(isDisallowedPlaceholderImageUrl("https://loremflickr.com/640/420/eau,gaming/all?lock=345942259")).toBe(true);
    expect(isDisallowedPlaceholderImageUrl("data:image/svg+xml;charset=UTF-8,%3Csvg%3E%3C%2Fsvg%3E")).toBe(false);
  });

  test("prefers a meaningful focus word from the transcript when available", () => {
    const blank = getMediaBlank(
      {
        sourceUrl: "https://example.com/video",
        transcriptSegment: "Today we practice cooking pasta with fresh basil and simple sauce.",
      },
      ["basil", "pasta"]
    );

    expect(blank).toEqual({
      answer: "pasta",
      transcriptWithBlank: "Today we practice cooking _____ with fresh basil and simple sauce.",
    });
  });

  test("does not blank trivial function words", () => {
    const blank = getMediaBlank({
      sourceUrl: "https://example.com/video",
      transcriptSegment: "We are in the park and we are very happy today.",
    });

    expect(blank).not.toBeNull();
    expect(blank?.answer).not.toBe("are");
    expect(blank?.answer).not.toBe("the");
    expect(blank?.transcriptWithBlank).toContain("_____");
  });
});
