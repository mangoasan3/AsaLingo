import { getSeedFallbackTranslation } from "../seeds/learningSeed";

describe("learning seed fallback translations", () => {
  test("uses aligned vocabulary translations instead of meta placeholders", () => {
    const translation = getSeedFallbackTranslation("nourriture", "fr", "en");

    expect(translation).toBe("food");
    expect(translation).not.toMatch(/\bmeaning\b/i);
  });

  test("falls back to the word itself for unknown vocabulary", () => {
    expect(getSeedFallbackTranslation("mot-inconnu", "fr", "en")).toBe("mot-inconnu");
  });
});
