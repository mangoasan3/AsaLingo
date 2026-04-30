import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import {
  DEFAULT_LOCALE,
  getLocaleForNativeLanguage,
  getLocaleForUser,
  normalizeLocale,
} from "@/utils/locale";

function applyDarkMode(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", enabled);
}

interface LocaleState {
  locale: string;
  darkMode: boolean;
  setLocale: (locale: string) => void;
  setDarkMode: (darkMode: boolean) => void;
  toggleDarkMode: () => void;
  setLocaleFromNativeLanguage: (lang: string) => void;
  syncLocaleWithUser: (user: Pick<User, "nativeLanguage" | "onboardingDone"> | null | undefined) => void;
  resetLocale: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      darkMode: false,
      setLocale: (locale) => set({ locale: normalizeLocale(locale) }),
      setDarkMode: (darkMode) => {
        applyDarkMode(darkMode);
        set({ darkMode });
      },
      toggleDarkMode: () =>
        set((state) => {
          const darkMode = !state.darkMode;
          applyDarkMode(darkMode);
          return { darkMode };
        }),
      setLocaleFromNativeLanguage: (lang) =>
        set({ locale: getLocaleForNativeLanguage(lang) }),
      syncLocaleWithUser: (user) =>
        set({ locale: getLocaleForUser(user) }),
      resetLocale: () => set({ locale: DEFAULT_LOCALE }),
    }),
    {
      name: "asalingo-locale",
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<LocaleState> | undefined;
        if (version < 2 && state?.locale === "ru") {
          return { ...state, locale: DEFAULT_LOCALE };
        }
        return state ?? {};
      },
      onRehydrateStorage: () => (state) => {
        applyDarkMode(Boolean(state?.darkMode));
      },
    }
  )
);
