/**
 * Lightweight i18n system for AsaLingo.
 * Defaults to English. Switches locale via useLocaleStore.
 * Supports all 10 UI locales: en, ru, es, fr, de, it, pt, ja, ko, zh.
 */
import { useMemo } from "react";
import ru from "./ru";
import en from "./en";
import de from "./de";
import es from "./es";
import fr from "./fr";
import it from "./it";
import pt from "./pt";
import ja from "./ja";
import ko from "./ko";
import zh from "./zh";
import supplementalTranslations from "./supplemental";
import type { Translations } from "./ru";
import { useLocaleStore } from "@/store/localeStore";

const translations: Record<string, Translations> = {
  en,
  ru,
  de,
  es,
  fr,
  it,
  pt,
  ja,
  ko,
  zh,
};

const DEFAULT_LANG = "en";
const FALLBACK_LANG = "en";

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overlay?: Record<string, unknown>
): T {
  if (!overlay) return base;
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(
        current as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

function createT(lang: string): TFunction {
  const defaultDict = deepMerge(
    translations[DEFAULT_LANG] as Record<string, unknown>,
    supplementalTranslations[DEFAULT_LANG]
  );
  const fallbackDict = deepMerge(
    translations[FALLBACK_LANG] as Record<string, unknown>,
    supplementalTranslations[FALLBACK_LANG]
  );
  const selectedDict = translations[lang]
    ? deepMerge(
        translations[lang] as Record<string, unknown>,
        supplementalTranslations[lang]
      )
    : {};
  const dict = deepMerge(defaultDict, selectedDict);

  return (key: string, vars?: Record<string, string | number>): string => {
    const value =
      getNestedValue(dict, key) ??
      getNestedValue(fallbackDict, key) ??
      key;
    return interpolate(value, vars);
  };
}

/**
 * Reactive translation hook. Reads locale from the persisted locale store.
 * Returns a new t() function whenever the locale changes.
 */
export function useT(): TFunction {
  const locale = useLocaleStore((s) => s.locale);
  return useMemo(() => createT(locale), [locale]);
}

export default useT;
