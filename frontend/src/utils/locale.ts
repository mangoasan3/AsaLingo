import type { User } from "@/types";
import { normalizeLanguageCode } from "@/utils/language";

export const DEFAULT_LOCALE = "en";

export function normalizeLocale(locale?: string | null): string {
  return normalizeLanguageCode(locale, DEFAULT_LOCALE);
}

export function getLocaleForNativeLanguage(nativeLanguage?: string | null): string {
  return normalizeLocale(nativeLanguage);
}

export function getLocaleForUser(
  user?: Pick<User, "nativeLanguage" | "onboardingDone"> | null
): string {
  return getLocaleForNativeLanguage(user?.nativeLanguage);
}
