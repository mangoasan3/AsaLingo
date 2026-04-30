import { describe, it, expect } from "vitest";
import { normalizeLanguageCode, getLanguageLabel, LANGUAGE_LABELS } from "../utils/language";

describe("normalizeLanguageCode", () => {
  it("maps standard codes to themselves", () => {
    expect(normalizeLanguageCode("en")).toBe("en");
    expect(normalizeLanguageCode("ru")).toBe("ru");
    expect(normalizeLanguageCode("ja")).toBe("ja");
  });

  it("maps common aliases to canonical codes", () => {
    expect(normalizeLanguageCode("english")).toBe("en");
    expect(normalizeLanguageCode("russian")).toBe("ru");
    expect(normalizeLanguageCode("japanese")).toBe("ja");
  });

  it("is case-insensitive", () => {
    expect(normalizeLanguageCode("English")).toBe("en");
    expect(normalizeLanguageCode("RUSSIAN")).toBe("ru");
  });

  it("returns the fallback for unknown codes", () => {
    expect(normalizeLanguageCode("klingon")).toBe("en");
    expect(normalizeLanguageCode(null)).toBe("en");
    expect(normalizeLanguageCode(undefined)).toBe("en");
  });

  it("accepts a custom fallback", () => {
    expect(normalizeLanguageCode("xyz", "fr")).toBe("fr");
  });
});

describe("LANGUAGE_LABELS", () => {
  it("covers all 10 supported locales", () => {
    const expected = ["en", "ru", "es", "fr", "de", "it", "pt", "ja", "ko", "zh"];
    for (const code of expected) {
      expect(LANGUAGE_LABELS[code]).toBeTruthy();
    }
  });
});

describe("getLanguageLabel", () => {
  it("returns a non-empty string for all supported codes", () => {
    for (const code of Object.keys(LANGUAGE_LABELS)) {
      expect(getLanguageLabel(code).length).toBeGreaterThan(0);
    }
  });

  it("localizes supported language names", () => {
    expect(getLanguageLabel("en", "ru")).toBe("Английский");
    expect(getLanguageLabel("ru", "en")).toBe("Russian");
    expect(getLanguageLabel("ja", "es")).toBe("Japonés");
    expect(getLanguageLabel("de", "fr")).toBe("Allemand");
  });

  it("uses the English UI default for null/undefined input", () => {
    expect(getLanguageLabel(null)).toBe("English");
    expect(getLanguageLabel(undefined)).toBe("English");
  });
});
