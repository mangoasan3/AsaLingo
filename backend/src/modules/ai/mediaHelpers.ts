import type { IMediaTask, IVocabularyWord } from "../../models";
import { DEFAULT_TOPIC } from "../../constants/topics";
import { normalizeTopic } from "../../utils/language";

export type ImageWordLike = Pick<
  IVocabularyWord,
  | "id"
  | "word"
  | "translation"
  | "definition"
  | "partOfSpeech"
  | "topic"
  | "exampleSentence"
  | "collocations"
  | "synonyms"
  | "progressionStep"
>;

export type MediaLike = Pick<IMediaTask, "transcriptSegment" | "sourceUrl">;

const TOPIC_IMAGE_HINTS: Partial<Record<string, string[]>> = {
  "daily life": ["home", "everyday", "routine", "household"],
  greetings: ["people", "conversation", "meeting", "hello"],
  travel: ["trip", "tourism", "landmark", "journey"],
  food: ["meal", "cooking", "restaurant", "fresh"],
  shopping: ["store", "retail", "market", "purchase"],
  family: ["home", "people", "parents", "children"],
  friends: ["people", "social", "group", "smile"],
  work: ["office", "career", "desk", "coworker"],
  business: ["office", "meeting", "presentation", "finance"],
  university: ["campus", "study", "lecture", "library"],
  school: ["classroom", "study", "teacher", "students"],
  technology: ["device", "digital", "screen", "computer"],
  design: ["creative", "studio", "colors", "sketch"],
  "social media": ["phone", "online", "selfie", "content"],
  health: ["wellness", "medical", "healthy", "clinic"],
  fitness: ["exercise", "gym", "running", "training"],
  emotions: ["face", "feeling", "expression", "mood"],
  communication: ["talking", "message", "conversation", "speaking"],
  movies: ["cinema", "film", "screen", "scene"],
  music: ["instrument", "concert", "song", "audio"],
  gaming: ["controller", "screen", "game", "player"],
  culture: ["tradition", "festival", "museum", "city"],
  transportation: ["vehicle", "street", "station", "transit"],
  housing: ["apartment", "house", "room", "building"],
  money: ["cash", "payment", "wallet", "bank"],
  nature: ["forest", "outdoor", "mountain", "river"],
};

const IMAGE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const GENERIC_IMAGE_WORDS = new Set([
  "area",
  "concept",
  "example",
  "idea",
  "item",
  "object",
  "person",
  "place",
  "someone",
  "something",
  "thing",
  "way",
]);

const ABSTRACT_IMAGE_WORDS = new Set([
  "advice",
  "answer",
  "belief",
  "choice",
  "communication",
  "consequence",
  "culture",
  "decision",
  "experience",
  "fact",
  "feeling",
  "goal",
  "help",
  "idea",
  "information",
  "knowledge",
  "language",
  "meaning",
  "memory",
  "news",
  "nuance",
  "opinion",
  "plan",
  "problem",
  "progress",
  "question",
  "reason",
  "research",
  "result",
  "skill",
  "time",
  "work",
  "hello",
  "thanks",
  "please",
  "where",
  "today",
  "tomorrow",
  "because",
  "need",
  "good",
  "usually",
]);

type CuratedImageAsset = {
  aliases: string[];
  symbolEntity: string;
  background: string;
  accent: string;
};

const CURATED_IMAGE_ASSETS: CuratedImageAsset[] = [
  {
    aliases: ["apple", "pomme", "manzana", "apfel", "mela", "maca", "yabloko"],
    symbolEntity: "&#x1F34E;",
    background: "#fff1f2",
    accent: "#e11d48",
  },
  {
    aliases: ["water", "agua", "eau", "wasser", "acqua", "voda"],
    symbolEntity: "&#x1F4A7;",
    background: "#e0f2fe",
    accent: "#0284c7",
  },
  {
    aliases: ["house", "home", "casa", "maison", "haus", "dom"],
    symbolEntity: "&#x1F3E0;",
    background: "#fef3c7",
    accent: "#d97706",
  },
  {
    aliases: ["book", "libro", "livre", "buch", "livro", "kniga"],
    symbolEntity: "&#x1F4D6;",
    background: "#ecfccb",
    accent: "#65a30d",
  },
  {
    aliases: ["phone", "telephone", "telefono", "portable", "smartphone"],
    symbolEntity: "&#x1F4F1;",
    background: "#f1f5f9",
    accent: "#475569",
  },
  {
    aliases: ["computer", "laptop", "ordinateur", "computadora", "computer"],
    symbolEntity: "&#x1F4BB;",
    background: "#e0e7ff",
    accent: "#4f46e5",
  },
  {
    aliases: ["car", "coche", "auto", "voiture", "wagen", "carro"],
    symbolEntity: "&#x1F697;",
    background: "#fee2e2",
    accent: "#dc2626",
  },
  {
    aliases: ["bus", "autobus"],
    symbolEntity: "&#x1F68C;",
    background: "#fef9c3",
    accent: "#ca8a04",
  },
  {
    aliases: ["train", "tren", "zug", "trem"],
    symbolEntity: "&#x1F686;",
    background: "#e0f2fe",
    accent: "#0369a1",
  },
  {
    aliases: ["airplane", "plane", "avion", "aviao", "flugzeug"],
    symbolEntity: "&#x2708;&#xFE0F;",
    background: "#dbeafe",
    accent: "#2563eb",
  },
  {
    aliases: ["bicycle", "bike", "bicicleta", "velo", "fahrrad"],
    symbolEntity: "&#x1F6B2;",
    background: "#dcfce7",
    accent: "#16a34a",
  },
  {
    aliases: ["dog", "perro", "chien", "hund", "cao"],
    symbolEntity: "&#x1F436;",
    background: "#ffedd5",
    accent: "#ea580c",
  },
  {
    aliases: ["cat", "gato", "chat", "katze"],
    symbolEntity: "&#x1F431;",
    background: "#fae8ff",
    accent: "#c026d3",
  },
  {
    aliases: ["coffee", "cafe", "kaffee", "caffe"],
    symbolEntity: "&#x2615;",
    background: "#f5f5f4",
    accent: "#78716c",
  },
  {
    aliases: ["tea", "the", "tee", "cha"],
    symbolEntity: "&#x1F375;",
    background: "#f0fdf4",
    accent: "#15803d",
  },
  {
    aliases: ["bread", "pan", "pain", "brot", "pao"],
    symbolEntity: "&#x1F35E;",
    background: "#fef3c7",
    accent: "#b45309",
  },
  {
    aliases: ["milk", "leche", "lait", "milch", "leite"],
    symbolEntity: "&#x1F95B;",
    background: "#f8fafc",
    accent: "#64748b",
  },
  {
    aliases: ["egg", "huevo", "oeuf", "ei", "ovo"],
    symbolEntity: "&#x1F95A;",
    background: "#fff7ed",
    accent: "#f97316",
  },
  {
    aliases: ["pizza"],
    symbolEntity: "&#x1F355;",
    background: "#fff7ed",
    accent: "#f97316",
  },
  {
    aliases: ["banana", "banane"],
    symbolEntity: "&#x1F34C;",
    background: "#fefce8",
    accent: "#eab308",
  },
  {
    aliases: ["orange", "naranja", "laranja"],
    symbolEntity: "&#x1F34A;",
    background: "#ffedd5",
    accent: "#f97316",
  },
  {
    aliases: ["school", "escuela", "ecole", "schule", "escola"],
    symbolEntity: "&#x1F3EB;",
    background: "#fef2f2",
    accent: "#ef4444",
  },
  {
    aliases: ["office", "oficina", "bureau", "buro", "escritorio"],
    symbolEntity: "&#x1F3E2;",
    background: "#f1f5f9",
    accent: "#475569",
  },
  {
    aliases: ["store", "shop", "tienda", "magasin", "laden", "loja"],
    symbolEntity: "&#x1F3EA;",
    background: "#ecfeff",
    accent: "#0891b2",
  },
  {
    aliases: ["restaurant", "restaurante"],
    symbolEntity: "&#x1F37D;&#xFE0F;",
    background: "#fff1f2",
    accent: "#be123c",
  },
  {
    aliases: ["park", "parque", "parc"],
    symbolEntity: "&#x1F3DE;&#xFE0F;",
    background: "#dcfce7",
    accent: "#16a34a",
  },
  {
    aliases: ["tree", "arbol", "arbre", "baum", "arvore"],
    symbolEntity: "&#x1F333;",
    background: "#dcfce7",
    accent: "#15803d",
  },
  {
    aliases: ["flower", "flor", "fleur", "blume"],
    symbolEntity: "&#x1F33C;",
    background: "#fce7f3",
    accent: "#db2777",
  },
  {
    aliases: ["mountain", "montana", "montagne", "berg", "montanha"],
    symbolEntity: "&#x26F0;&#xFE0F;",
    background: "#e7e5e4",
    accent: "#57534e",
  },
  {
    aliases: ["river", "rio", "riviere", "fluss"],
    symbolEntity: "&#x1F3DE;&#xFE0F;",
    background: "#e0f2fe",
    accent: "#0284c7",
  },
  {
    aliases: ["beach", "playa", "plage", "strand", "praia"],
    symbolEntity: "&#x1F3D6;&#xFE0F;",
    background: "#fef3c7",
    accent: "#0ea5e9",
  },
  {
    aliases: ["sun", "sol", "soleil", "sonne"],
    symbolEntity: "&#x2600;&#xFE0F;",
    background: "#fef9c3",
    accent: "#eab308",
  },
  {
    aliases: ["rain", "lluvia", "pluie", "regen", "chuva"],
    symbolEntity: "&#x1F327;&#xFE0F;",
    background: "#dbeafe",
    accent: "#2563eb",
  },
  {
    aliases: ["snow", "nieve", "neige", "schnee", "neve"],
    symbolEntity: "&#x2744;&#xFE0F;",
    background: "#f8fafc",
    accent: "#38bdf8",
  },
  {
    aliases: ["city", "ciudad", "ville", "stadt", "cidade"],
    symbolEntity: "&#x1F3D9;&#xFE0F;",
    background: "#f1f5f9",
    accent: "#334155",
  },
  {
    aliases: ["money", "cash", "dinero", "argent", "geld", "dinheiro"],
    symbolEntity: "&#x1F4B5;",
    background: "#dcfce7",
    accent: "#16a34a",
  },
  {
    aliases: ["key", "llave", "cle", "schluessel", "chave"],
    symbolEntity: "&#x1F511;",
    background: "#fef9c3",
    accent: "#ca8a04",
  },
  {
    aliases: ["door", "puerta", "porte", "tur", "porta"],
    symbolEntity: "&#x1F6AA;",
    background: "#ffedd5",
    accent: "#c2410c",
  },
  {
    aliases: ["bed", "cama", "lit", "bett"],
    symbolEntity: "&#x1F6CF;&#xFE0F;",
    background: "#e0e7ff",
    accent: "#6366f1",
  },
  {
    aliases: ["shirt", "camisa", "chemise", "hemd"],
    symbolEntity: "&#x1F455;",
    background: "#dbeafe",
    accent: "#2563eb",
  },
  {
    aliases: ["shoe", "zapato", "chaussure", "schuh", "sapato"],
    symbolEntity: "&#x1F45F;",
    background: "#f5f5f4",
    accent: "#57534e",
  },
  {
    aliases: ["suitcase", "travel", "trip", "viagem", "viaje", "reise", "voyage"],
    symbolEntity: "&#x1F9F3;",
    background: "#fef3c7",
    accent: "#d97706",
  },
  {
    aliases: ["game", "gaming", "controller", "juego", "jeu", "spiel", "jogo"],
    symbolEntity: "&#x1F3AE;",
    background: "#ede9fe",
    accent: "#7c3aed",
  },
  {
    aliases: ["music", "musica", "musique"],
    symbolEntity: "&#x1F3B5;",
    background: "#fae8ff",
    accent: "#c026d3",
  },
  {
    aliases: ["camera", "camara", "kamera"],
    symbolEntity: "&#x1F4F7;",
    background: "#f1f5f9",
    accent: "#475569",
  },
];

const CURATED_IMAGE_BY_ALIAS = new Map(
  CURATED_IMAGE_ASSETS.flatMap((asset) => asset.aliases.map((alias) => [alias, asset] as const))
);

const DISALLOWED_IMAGE_URL_PATTERNS = [
  /loremflickr\.com/i,
  /placehold(?:er)?\./i,
  /placehold\.co/i,
  /picsum\.photos/i,
  /dummyimage\.com/i,
  /fakeimg\.pl/i,
];

const MEDIA_FUNCTION_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "must",
  "to", "of", "in", "on", "at", "for", "from", "by", "with", "into",
  "and", "or", "but", "so", "yet", "nor", "if", "as", "than",
  "that", "this", "these", "those", "it", "its",
  "they", "them", "their", "we", "our", "you", "your", "he", "his",
  "she", "her", "i", "my", "me", "who", "which", "what",
  "not", "no", "nor", "just", "also", "then", "when", "where",
  "how", "very", "too", "more", "most", "some", "any", "all",
  "there", "here", "up", "out", "about", "over", "after", "before",
]);

function cleanText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toImageKeyword(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-");
}

function normalizeImageAlias(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-");
}

function hasLetters(value: string): boolean {
  return /\p{L}/u.test(value);
}

function hasLatinLetters(value: string): boolean {
  return /\p{Script=Latin}/u.test(value);
}

function isUsefulImageKeyword(value: string): boolean {
  if (!value || value.length <= 2) return false;
  if (/\d/.test(value)) return false;
  if (!hasLetters(value)) return false;
  if (!hasLatinLetters(value)) return false;
  if (IMAGE_STOPWORDS.has(value)) return false;
  if (GENERIC_IMAGE_WORDS.has(value)) return false;
  if (ABSTRACT_IMAGE_WORDS.has(value)) return false;
  return true;
}

function extractKeywordCandidates(value: string, limit = 4): string[] {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2)
    .filter((item) => !IMAGE_STOPWORDS.has(item))
    .slice(0, limit);
}

export function isImageFriendlyWord(word: ImageWordLike): boolean {
  const normalized = normalizeAnswer(word.word);
  const canBeVisual = word.partOfSpeech === "NOUN";

  if (!canBeVisual) return false;
  if (!normalized || normalized.length <= 1 || normalized.includes(" ")) return false;
  if (ABSTRACT_IMAGE_WORDS.has(normalized) || GENERIC_IMAGE_WORDS.has(normalized)) return false;
  if (/(tion|sion|ness|ment|ity|ism|ship|ance|ence|acy|hood)$/i.test(normalized)) return false;
  return Boolean(getCuratedImageAsset(word));
}

export function buildImageKeywords(word: ImageWordLike): string[] {
  const topic = normalizeTopic(cleanText(word.topic), DEFAULT_TOPIC);
  const topicHints = TOPIC_IMAGE_HINTS[topic] ?? [];
  const keywordCandidates = [
    word.word,
    cleanText(word.synonyms[0]),
    ...extractKeywordCandidates(word.collocations[0], 3),
    topic !== DEFAULT_TOPIC ? topic : "",
    ...topicHints,
    ...extractKeywordCandidates(word.definition, 5),
    ...extractKeywordCandidates(word.exampleSentence, 5),
    cleanText(word.translation),
  ];

  return [...new Set(
    keywordCandidates
      .map(toImageKeyword)
      .filter(Boolean)
      .filter(isUsefulImageKeyword)
  )].slice(0, 6);
}

export function buildImageSearchTags(word: ImageWordLike): string[] {
  const keywords = buildImageKeywords(word);
  const primary = keywords[0];
  if (!primary) return [];

  const context = keywords.find((keyword) => keyword !== primary && !GENERIC_IMAGE_WORDS.has(keyword));
  return context ? [primary, context] : [];
}

export function buildImageUrl(word: ImageWordLike): string | undefined {
  if (!isImageFriendlyWord(word)) return undefined;
  const asset = getCuratedImageAsset(word);
  if (!asset) return undefined;
  return buildCuratedSvgDataUrl(asset);
}

export function isDisallowedPlaceholderImageUrl(value: unknown): boolean {
  const url = cleanText(value);
  return Boolean(url) && DISALLOWED_IMAGE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function getCuratedImageAsset(word: ImageWordLike): CuratedImageAsset | undefined {
  return CURATED_IMAGE_BY_ALIAS.get(normalizeImageAlias(word.word));
}

function buildCuratedSvgDataUrl(asset: CuratedImageAsset): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img">`,
    `<rect width="640" height="420" rx="0" fill="${asset.background}"/>`,
    `<circle cx="320" cy="210" r="150" fill="#ffffff" opacity="0.92"/>`,
    `<circle cx="320" cy="210" r="174" fill="none" stroke="${asset.accent}" stroke-width="14" opacity="0.55"/>`,
    `<text x="320" y="265" text-anchor="middle" font-size="178" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${asset.symbolEntity}</text>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getMediaBlank(
  media: MediaLike,
  preferredAnswers: string[] = []
): { transcriptWithBlank: string; answer: string } | null {
  const transcript = cleanText(media.transcriptSegment);
  const allTokens = transcript.replace(/[.!?,;:]+/g, "").split(/\s+/).filter(Boolean);
  if (allTokens.length < 4) return null;
  const preferred = new Set(preferredAnswers.map((item) => normalizeAnswer(item)).filter(Boolean));

  const contentWords = allTokens
    .slice(1, allTokens.length - 1)
    .filter((token) => token.length >= 4 && !MEDIA_FUNCTION_WORDS.has(token.toLowerCase()));

  if (contentWords.length === 0) return null;

  const preferredMatch = contentWords.find((token) => preferred.has(normalizeAnswer(token)));
  const answer = preferredMatch ?? contentWords[Math.floor(contentWords.length / 2)];

  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const transcriptWithBlank = transcript.replace(new RegExp(`\\b${escaped}\\b`, "i"), "_____");
  if (transcriptWithBlank === transcript) return null;

  return {
    answer: answer.toLowerCase(),
    transcriptWithBlank,
  };
}
