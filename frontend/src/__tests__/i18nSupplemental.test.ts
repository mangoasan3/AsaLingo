import { describe, expect, it } from "vitest";
import en from "../i18n/en";
import supplementalTranslations from "../i18n/supplemental";

const localizedLocales = ["ru", "es", "fr", "de", "it", "pt", "ja", "ko", "zh"] as const;
const supplementalOnboardingLocales = ["es", "fr", "de", "it", "pt", "ja", "ko", "zh"] as const;

type PracticeSupplement = {
  live: Record<string, string>;
  exerciseTypes: Record<string, string>;
};

type OnboardingSupplement = {
  setup: Record<string, string>;
};

function getPractice(locale: string): PracticeSupplement {
  const practice = supplementalTranslations[locale]?.practice as
    | Partial<PracticeSupplement>
    | undefined;

  if (!practice?.live || !practice.exerciseTypes) {
    throw new Error(`Missing practice supplemental translations for ${locale}`);
  }

  return {
    live: practice.live,
    exerciseTypes: practice.exerciseTypes,
  };
}

function getOnboarding(locale: string): OnboardingSupplement {
  const onboarding = supplementalTranslations[locale]?.onboarding as
    | Partial<OnboardingSupplement>
    | undefined;

  if (!onboarding?.setup) {
    throw new Error(`Missing onboarding supplemental translations for ${locale}`);
  }

  return {
    setup: onboarding.setup,
  };
}

describe("supplemental i18n practice translations", () => {
  it("does not fall back to English for localized practice status copy", () => {
    const english = getPractice("en").live;

    for (const locale of localizedLocales) {
      const localized = getPractice(locale).live;
      for (const key of Object.keys(english)) {
        expect(localized[key], `${locale}.practice.live.${key}`).toBeTruthy();
        expect(localized[key], `${locale}.practice.live.${key}`).not.toBe(english[key]);
      }
    }
  });

  it("does not fall back to English for localized exercise type labels", () => {
    const english = getPractice("en").exerciseTypes;

    for (const locale of localizedLocales) {
      const localized = getPractice(locale).exerciseTypes;
      for (const key of Object.keys(english)) {
        expect(localized[key], `${locale}.practice.exerciseTypes.${key}`).toBeTruthy();
        expect(localized[key], `${locale}.practice.exerciseTypes.${key}`).not.toBe(english[key]);
      }
    }
  });
});

describe("supplemental i18n onboarding translations", () => {
  it("localizes the language setup block instead of falling back to English", () => {
    const englishSetup = (en.onboarding as { setup: Record<string, string> }).setup;
    const requiredKeys = [
      "title",
      "description",
      "languagesTitle",
      "languagesSubtitle",
      "nativeLabel",
      "studyLabel",
    ];

    for (const locale of supplementalOnboardingLocales) {
      const localized = getOnboarding(locale).setup;
      for (const key of requiredKeys) {
        expect(localized[key], `${locale}.onboarding.setup.${key}`).toBeTruthy();
        expect(localized[key], `${locale}.onboarding.setup.${key}`).not.toBe(englishSetup[key]);
      }
    }
  });
});
