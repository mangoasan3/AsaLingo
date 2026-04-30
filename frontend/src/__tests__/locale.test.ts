import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getLocaleForNativeLanguage, normalizeLocale } from "../utils/locale";

describe("locale defaults", () => {
  it("defaults the interface to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
    expect(normalizeLocale(null)).toBe("en");
  });

  it("maps native language aliases to supported UI locales", () => {
    expect(getLocaleForNativeLanguage("русский")).toBe("ru");
    expect(getLocaleForNativeLanguage("english")).toBe("en");
    expect(getLocaleForNativeLanguage("日本語")).toBe("ja");
  });
});
