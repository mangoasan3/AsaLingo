export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
};

const LOCALIZED_LANGUAGE_LABELS: Record<string, Record<string, string>> = {
  en: {
    en: "English",
    ru: "Russian",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
  },
  ru: {
    en: "Английский",
    ru: "Русский",
    es: "Испанский",
    fr: "Французский",
    de: "Немецкий",
    it: "Итальянский",
    pt: "Португальский",
    ja: "Японский",
    ko: "Корейский",
    zh: "Китайский",
  },
  es: {
    en: "Inglés",
    ru: "Ruso",
    es: "Español",
    fr: "Francés",
    de: "Alemán",
    it: "Italiano",
    pt: "Portugués",
    ja: "Japonés",
    ko: "Coreano",
    zh: "Chino",
  },
  fr: {
    en: "Anglais",
    ru: "Russe",
    es: "Espagnol",
    fr: "Français",
    de: "Allemand",
    it: "Italien",
    pt: "Portugais",
    ja: "Japonais",
    ko: "Coréen",
    zh: "Chinois",
  },
  de: {
    en: "Englisch",
    ru: "Russisch",
    es: "Spanisch",
    fr: "Französisch",
    de: "Deutsch",
    it: "Italienisch",
    pt: "Portugiesisch",
    ja: "Japanisch",
    ko: "Koreanisch",
    zh: "Chinesisch",
  },
  it: {
    en: "Inglese",
    ru: "Russo",
    es: "Spagnolo",
    fr: "Francese",
    de: "Tedesco",
    it: "Italiano",
    pt: "Portoghese",
    ja: "Giapponese",
    ko: "Coreano",
    zh: "Cinese",
  },
  pt: {
    en: "Inglês",
    ru: "Russo",
    es: "Espanhol",
    fr: "Francês",
    de: "Alemão",
    it: "Italiano",
    pt: "Português",
    ja: "Japonês",
    ko: "Coreano",
    zh: "Chinês",
  },
  ja: {
    en: "英語",
    ru: "ロシア語",
    es: "スペイン語",
    fr: "フランス語",
    de: "ドイツ語",
    it: "イタリア語",
    pt: "ポルトガル語",
    ja: "日本語",
    ko: "韓国語",
    zh: "中国語",
  },
  ko: {
    en: "영어",
    ru: "러시아어",
    es: "스페인어",
    fr: "프랑스어",
    de: "독일어",
    it: "이탈리아어",
    pt: "포르투갈어",
    ja: "일본어",
    ko: "한국어",
    zh: "중국어",
  },
  zh: {
    en: "英语",
    ru: "俄语",
    es: "西班牙语",
    fr: "法语",
    de: "德语",
    it: "意大利语",
    pt: "葡萄牙语",
    ja: "日语",
    ko: "韩语",
    zh: "中文",
  },
};

const LANGUAGE_ALIASES: Record<string, string[]> = {
  en: ["en", "eng", "english", "английский"],
  ru: ["ru", "rus", "russian", "русский", "русская", "рус"],
  es: ["es", "esp", "spanish", "espanol", "español", "испанский"],
  fr: ["fr", "fra", "french", "francais", "français", "французский"],
  de: ["de", "deu", "german", "deutsch", "немецкий"],
  it: ["it", "ita", "italian", "italiano", "итальянский"],
  pt: ["pt", "por", "portuguese", "portugues", "português", "brazilian portuguese", "португальский"],
  ja: ["ja", "jpn", "japanese", "nihongo", "日本語", "японский"],
  ko: ["ko", "kor", "korean", "한국어", "корейский"],
  zh: ["zh", "zho", "chinese", "mandarin", "中文", "汉语", "китайский"],
};

const aliasToCode = new Map<string, string>();

for (const [code, aliases] of Object.entries(LANGUAGE_ALIASES)) {
  aliasToCode.set(code.toLowerCase(), code);
  aliasToCode.set(LANGUAGE_LABELS[code].toLowerCase(), code);
  for (const alias of aliases) {
    aliasToCode.set(alias.toLowerCase(), code);
  }
}

const NATIVE_LANGUAGE_ALIASES: Record<string, string[]> = {
  en: ["английский", "english language"],
  ru: ["русский", "русская", "рус"],
  es: ["español", "испанский"],
  fr: ["français", "французский"],
  de: ["немецкий"],
  it: ["итальянский"],
  pt: ["português", "португальский"],
  ja: ["日本語", "にほんご", "японский"],
  ko: ["한국어", "조선말", "корейский"],
  zh: ["中文", "汉语", "普通话", "китайский"],
};

for (const [code, aliases] of Object.entries(NATIVE_LANGUAGE_ALIASES)) {
  for (const alias of aliases) {
    aliasToCode.set(alias.toLowerCase(), code);
  }
}

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_LABELS).map(([code, label]) => ({
  code,
  label,
}));

export function normalizeLanguageCode(code?: string | null, fallback = "en"): string {
  if (!code) return fallback;
  return aliasToCode.get(code.trim().toLowerCase()) ?? fallback;
}

function capitalizeForLocale(value: string, locale: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

export function getLanguageLabel(code?: string | null, locale = "en"): string {
  if (!code) return LOCALIZED_LANGUAGE_LABELS[normalizeLanguageCode(locale)]?.en ?? LANGUAGE_LABELS.en;

  const normalizedCode = normalizeLanguageCode(code, "");
  if (!normalizedCode) return code;
  const normalizedLocale = normalizeLanguageCode(locale);

  const localizedLabel = LOCALIZED_LANGUAGE_LABELS[normalizedLocale]?.[normalizedCode];
  if (localizedLabel) return localizedLabel;

  try {
    const displayName = new Intl.DisplayNames([normalizedLocale], {
      type: "language",
    }).of(normalizedCode);

    if (displayName) {
      return capitalizeForLocale(displayName, normalizedLocale);
    }
  } catch {
    // Intl.DisplayNames may be unavailable in older runtimes.
  }

  return LANGUAGE_LABELS[normalizedCode] ?? code;
}
