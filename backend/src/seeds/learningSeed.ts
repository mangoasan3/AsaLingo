import {
  CurriculumNode,
  MediaTask,
  VocabularyWord,
} from "../models";
import type {
  CefrLevel,
  ICurriculumNode,
  IExerciseMixItem,
  IVocabularyWord,
  LearnerStage,
  PartOfSpeech,
  ScriptStage,
} from "../models";
import { CURATED_MEDIA_TASKS } from "../constants/curatedMediaTasks";
import { normalizeLanguageCode } from "../utils/language";

type CurriculumSeed = Pick<
  ICurriculumNode,
  | "nodeKey"
  | "language"
  | "level"
  | "learnerStage"
  | "stage"
  | "stageOrder"
  | "unit"
  | "lesson"
  | "title"
  | "objective"
  | "description"
  | "skillFocus"
  | "scriptFocus"
  | "exerciseMix"
  | "recommendedVocabulary"
  | "grammarTargets"
  | "interestTags"
  | "estimatedMinutes"
> & {
  unlockCriteria?: ICurriculumNode["unlockCriteria"];
};

type WordSeed = Pick<
  IVocabularyWord,
  | "word"
  | "translation"
  | "definition"
  | "partOfSpeech"
  | "cefrLevel"
  | "topic"
  | "exampleSentence"
  | "easierExplanation"
  | "synonyms"
  | "collocations"
  | "pronunciation"
  | "language"
  | "nativeLanguage"
  | "explanationLanguage"
  | "sourceType"
  | "generatedBy"
  | "lessonStep"
  | "progressionStep"
  | "scriptStage"
  | "interestTags"
  | "grammarTags"
>;

const beginnerMix: IExerciseMixItem[] = [
  {
    type: "tap_translation",
    weight: 2,
    skill: "vocabulary",
    difficulty: 1,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "fast_tap",
  },
  {
    type: "matching",
    weight: 1,
    skill: "vocabulary",
    difficulty: 1,
    evaluationMode: "auto",
    mediaNeeds: "none",
    templateFamily: "pair_matching",
  },
  {
    type: "reorder_words",
    weight: 1,
    skill: "grammar",
    difficulty: 2,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "sentence_order",
  },
  {
    type: "choose_missing_word",
    weight: 1,
    skill: "grammar",
    difficulty: 2,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "guided_gap_choice",
  },
];

const intermediateMix: IExerciseMixItem[] = [
  {
    type: "fill_in_context",
    weight: 2,
    skill: "grammar",
    difficulty: 3,
    evaluationMode: "auto",
    mediaNeeds: "none",
    templateFamily: "contextual_gap",
  },
  {
    type: "reading_comprehension",
    weight: 2,
    skill: "reading",
    difficulty: 3,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "micro_reading",
  },
  {
    type: "translation_variants",
    weight: 1,
    skill: "writing",
    difficulty: 4,
    evaluationMode: "ai",
    mediaNeeds: "none",
    templateFamily: "variant_translation",
  },
];

const advancedMix: IExerciseMixItem[] = [
  {
    type: "summary",
    weight: 1,
    skill: "writing",
    difficulty: 5,
    evaluationMode: "rubric",
    mediaNeeds: "none",
    templateFamily: "summarization",
  },
  {
    type: "argument_response",
    weight: 1,
    skill: "writing",
    difficulty: 6,
    evaluationMode: "rubric",
    mediaNeeds: "none",
    templateFamily: "argument_writing",
  },
];

const choiceAndImageMix: IExerciseMixItem[] = [
  {
    type: "multiple_choice",
    weight: 2,
    skill: "vocabulary",
    difficulty: 1,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "recognition_choice",
  },
  {
    type: "reverse_multiple_choice",
    weight: 1,
    skill: "vocabulary",
    difficulty: 1,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "reverse_choice",
  },
  {
    type: "word_to_picture",
    weight: 1,
    skill: "vocabulary",
    difficulty: 1,
    evaluationMode: "exact",
    mediaNeeds: "image",
    templateFamily: "playful_picture_choice",
  },
  {
    type: "picture_to_word",
    weight: 1,
    skill: "vocabulary",
    difficulty: 1,
    evaluationMode: "exact",
    mediaNeeds: "image",
    templateFamily: "picture_word_choice",
  },
];

const productionMix: IExerciseMixItem[] = [
  {
    type: "translation_input",
    weight: 1,
    skill: "writing",
    difficulty: 3,
    evaluationMode: "ai",
    mediaNeeds: "none",
    templateFamily: "typed_translation",
  },
  {
    type: "open_translation",
    weight: 1,
    skill: "writing",
    difficulty: 4,
    evaluationMode: "ai",
    mediaNeeds: "none",
    templateFamily: "open_translation",
  },
  {
    type: "error_correction",
    weight: 1,
    skill: "grammar",
    difficulty: 4,
    evaluationMode: "ai",
    mediaNeeds: "none",
    templateFamily: "grammar_repair",
  },
  {
    type: "paraphrase_choice",
    weight: 1,
    skill: "reading",
    difficulty: 3,
    evaluationMode: "exact",
    mediaNeeds: "none",
    templateFamily: "meaning_paraphrase",
  },
];

const extendedWritingMix: IExerciseMixItem[] = [
  {
    type: "short_paragraph_response",
    weight: 1,
    skill: "writing",
    difficulty: 5,
    evaluationMode: "rubric",
    mediaNeeds: "none",
    templateFamily: "paragraph_response",
  },
  {
    type: "essay_writing",
    weight: 1,
    skill: "writing",
    difficulty: 6,
    evaluationMode: "rubric",
    mediaNeeds: "none",
    templateFamily: "extended_writing",
  },
];

export const SUPPORTED_CURRICULUM_LANGUAGES = [
  "en",
  "ru",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ja",
  "ko",
  "zh",
] as const;

type VocabularyByLevel = Record<CefrLevel, string[]>;

const LANGUAGE_VOCABULARY: Record<string, VocabularyByLevel> = {
  en: {
    A1: ["hello", "thanks", "please", "water", "food", "home", "friend", "where", "today", "good", "small", "need"],
    A2: ["morning", "evening", "work", "school", "shopping", "travel", "family", "weather", "usually", "because", "near", "tomorrow"],
    B1: ["opinion", "reason", "prefer", "compare", "explain", "problem", "solution", "although", "experience", "advice", "plan", "improve"],
    B2: ["trend", "evidence", "context", "tradeoff", "influence", "reliable", "assumption", "outcome", "perspective", "priority", "impact", "strategy"],
    C1: ["nuance", "implication", "counterargument", "synthesis", "negotiate", "ambiguity", "register", "constraint", "coherent", "subtle", "framework", "stance"],
    C2: ["perspicacious", "ephemeral", "meticulous", "concede", "ostensibly", "paradigm", "ramification", "equivocal", "salient", "tenuous", "idiosyncratic", "discourse"],
  },
  ru: {
    A1: ["привет", "спасибо", "пожалуйста", "вода", "еда", "дом", "друг", "где", "сегодня", "хорошо", "маленький", "нужно"],
    A2: ["утро", "вечер", "работа", "школа", "покупки", "поездка", "семья", "погода", "обычно", "потому что", "рядом", "завтра"],
    B1: ["мнение", "причина", "предпочитать", "сравнивать", "объяснять", "проблема", "решение", "хотя", "опыт", "совет", "план", "улучшать"],
    B2: ["тенденция", "доказательство", "контекст", "компромисс", "влияние", "надежный", "предположение", "результат", "точка зрения", "приоритет", "эффект", "стратегия"],
    C1: ["нюанс", "последствие", "контраргумент", "синтез", "договариваться", "двусмысленность", "регистр", "ограничение", "связный", "тонкий", "модель", "позиция"],
    C2: ["проницательный", "мимолетный", "скрупулезный", "уступать", "якобы", "парадигма", "последствия", "двоякий", "существенный", "шаткий", "своеобразный", "дискурс"],
  },
  es: {
    A1: ["hola", "gracias", "por favor", "agua", "comida", "casa", "amigo", "donde", "hoy", "bueno", "pequeno", "necesito"],
    A2: ["manana", "noche", "trabajo", "escuela", "compras", "viaje", "familia", "tiempo", "normalmente", "porque", "cerca", "manana"],
    B1: ["opinion", "razon", "preferir", "comparar", "explicar", "problema", "solucion", "aunque", "experiencia", "consejo", "plan", "mejorar"],
    B2: ["tendencia", "evidencia", "contexto", "compromiso", "influencia", "fiable", "supuesto", "resultado", "perspectiva", "prioridad", "impacto", "estrategia"],
    C1: ["matiz", "implicacion", "contraargumento", "sintesis", "negociar", "ambiguedad", "registro", "restriccion", "coherente", "sutil", "marco", "postura"],
    C2: ["perspicaz", "efimero", "meticuloso", "conceder", "aparentemente", "paradigma", "repercusion", "equivoco", "destacado", "tenue", "idiosincratico", "discurso"],
  },
  fr: {
    A1: ["bonjour", "merci", "s'il vous plait", "eau", "nourriture", "maison", "ami", "ou", "aujourd'hui", "bon", "petit", "besoin"],
    A2: ["matin", "soir", "travail", "ecole", "achats", "voyage", "famille", "meteo", "d'habitude", "parce que", "pres", "demain"],
    B1: ["opinion", "raison", "preferer", "comparer", "expliquer", "probleme", "solution", "bien que", "experience", "conseil", "projet", "ameliorer"],
    B2: ["tendance", "preuve", "contexte", "compromis", "influence", "fiable", "hypothese", "resultat", "perspective", "priorite", "impact", "strategie"],
    C1: ["nuance", "implication", "contre-argument", "synthese", "negocier", "ambiguite", "registre", "contrainte", "coherent", "subtil", "cadre", "position"],
    C2: ["perspicace", "ephemere", "meticuleux", "conceder", "apparemment", "paradigme", "repercussion", "equivoque", "saillant", "fragile", "idiosyncratique", "discours"],
  },
  de: {
    A1: ["hallo", "danke", "bitte", "wasser", "essen", "haus", "freund", "wo", "heute", "gut", "klein", "brauchen"],
    A2: ["morgen", "abend", "arbeit", "schule", "einkaufen", "reise", "familie", "wetter", "normalerweise", "weil", "nahe", "morgen"],
    B1: ["meinung", "grund", "bevorzugen", "vergleichen", "erklaeren", "problem", "loesung", "obwohl", "erfahrung", "rat", "plan", "verbessern"],
    B2: ["trend", "beleg", "kontext", "kompromiss", "einfluss", "zuverlaessig", "annahme", "ergebnis", "perspektive", "prioritaet", "wirkung", "strategie"],
    C1: ["nuance", "implikation", "gegenargument", "synthese", "verhandeln", "mehrdeutigkeit", "register", "einschraenkung", "kohaerent", "subtil", "rahmen", "haltung"],
    C2: ["scharfsinnig", "fluechtig", "akribisch", "einraeumen", "angeblich", "paradigma", "auswirkung", "mehrdeutig", "hervorstechend", "duenn", "eigenwillig", "diskurs"],
  },
  it: {
    A1: ["ciao", "grazie", "per favore", "acqua", "cibo", "casa", "amico", "dove", "oggi", "buono", "piccolo", "bisogno"],
    A2: ["mattina", "sera", "lavoro", "scuola", "spesa", "viaggio", "famiglia", "tempo", "di solito", "perche", "vicino", "domani"],
    B1: ["opinione", "ragione", "preferire", "confrontare", "spiegare", "problema", "soluzione", "anche se", "esperienza", "consiglio", "piano", "migliorare"],
    B2: ["tendenza", "prova", "contesto", "compromesso", "influenza", "affidabile", "ipotesi", "risultato", "prospettiva", "priorita", "impatto", "strategia"],
    C1: ["sfumatura", "implicazione", "controargomento", "sintesi", "negoziare", "ambiguita", "registro", "vincolo", "coerente", "sottile", "quadro", "posizione"],
    C2: ["perspicace", "effimero", "meticoloso", "concedere", "apparentemente", "paradigma", "ripercussione", "equivoco", "saliente", "tenue", "idiosincratico", "discorso"],
  },
  pt: {
    A1: ["ola", "obrigado", "por favor", "agua", "comida", "casa", "amigo", "onde", "hoje", "bom", "pequeno", "preciso"],
    A2: ["manha", "noite", "trabalho", "escola", "compras", "viagem", "familia", "tempo", "normalmente", "porque", "perto", "amanha"],
    B1: ["opiniao", "razao", "preferir", "comparar", "explicar", "problema", "solucao", "embora", "experiencia", "conselho", "plano", "melhorar"],
    B2: ["tendencia", "evidencia", "contexto", "compromisso", "influencia", "confiavel", "suposicao", "resultado", "perspectiva", "prioridade", "impacto", "estrategia"],
    C1: ["nuance", "implicacao", "contra-argumento", "sintese", "negociar", "ambiguidade", "registro", "restricao", "coerente", "sutil", "estrutura", "posicao"],
    C2: ["perspicaz", "efemero", "meticuloso", "conceder", "ostensivamente", "paradigma", "ramificacao", "equivoco", "saliente", "tenue", "idiossincratico", "discurso"],
  },
  ja: {
    A1: ["こんにちは", "ありがとう", "お願いします", "水", "食べ物", "家", "友だち", "どこ", "今日", "いい", "小さい", "必要"],
    A2: ["朝", "夜", "仕事", "学校", "買い物", "旅行", "家族", "天気", "いつも", "だから", "近い", "明日"],
    B1: ["意見", "理由", "好む", "比べる", "説明する", "問題", "解決", "けれども", "経験", "助言", "予定", "改善する"],
    B2: ["傾向", "根拠", "文脈", "妥協", "影響", "信頼できる", "前提", "結果", "視点", "優先順位", "効果", "戦略"],
    C1: ["ニュアンス", "含意", "反論", "統合", "交渉する", "曖昧さ", "文体", "制約", "一貫した", "微妙な", "枠組み", "立場"],
    C2: ["洞察力のある", "儚い", "緻密な", "譲歩する", "表向きは", "パラダイム", "波及効果", "多義的な", "顕著な", "希薄な", "独特な", "談話"],
  },
  ko: {
    A1: ["안녕하세요", "감사합니다", "부탁해요", "물", "음식", "집", "친구", "어디", "오늘", "좋아요", "작은", "필요해요"],
    A2: ["아침", "저녁", "일", "학교", "쇼핑", "여행", "가족", "날씨", "보통", "왜냐하면", "가까운", "내일"],
    B1: ["의견", "이유", "선호하다", "비교하다", "설명하다", "문제", "해결", "비록", "경험", "조언", "계획", "개선하다"],
    B2: ["추세", "근거", "맥락", "타협", "영향", "신뢰할 수 있는", "가정", "결과", "관점", "우선순위", "효과", "전략"],
    C1: ["뉘앙스", "함의", "반론", "종합", "협상하다", "모호성", "문체", "제약", "일관된", "미묘한", "틀", "입장"],
    C2: ["통찰력 있는", "덧없는", "꼼꼼한", "인정하다", "표면상", "패러다임", "파급 효과", "애매한", "두드러진", "희박한", "독특한", "담론"],
  },
  zh: {
    A1: ["你好", "谢谢", "请", "水", "食物", "家", "朋友", "哪里", "今天", "好", "小", "需要"],
    A2: ["早上", "晚上", "工作", "学校", "购物", "旅行", "家庭", "天气", "通常", "因为", "附近", "明天"],
    B1: ["意见", "原因", "更喜欢", "比较", "解释", "问题", "解决", "虽然", "经验", "建议", "计划", "改善"],
    B2: ["趋势", "证据", "语境", "权衡", "影响", "可靠", "假设", "结果", "视角", "优先级", "作用", "策略"],
    C1: ["细微差别", "含义", "反驳", "综合", "协商", "歧义", "语域", "限制", "连贯", "微妙", "框架", "立场"],
    C2: ["有洞察力的", "短暂的", "一丝不苟的", "让步", "表面上", "范式", "影响后果", "含糊的", "显著的", "脆弱的", "独特的", "话语"],
  },
};

const LEVEL_GRAMMAR: Record<CefrLevel, string[]> = {
  A1: ["greetings", "pronouns", "basic word order", "yes/no questions", "polite requests", "numbers and time"],
  A2: ["daily routines", "past and future basics", "frequency", "requests", "comparatives", "simple connectors"],
  B1: ["opinions with reasons", "story sequencing", "modals and advice", "conditionals", "relative clauses", "repairing mistakes"],
  B2: ["hedging", "contrast and concession", "reported speech", "register choice", "summary structure", "evidence and stance"],
  C1: ["argument structure", "advanced connectors", "nominalization", "register control", "precision and nuance", "synthesis"],
  C2: ["idiomatic control", "rhetorical emphasis", "subtle implication", "dense syntax", "tone shifting", "near-native editing"],
};

type RoadmapLessonTemplate = {
  title: string;
  objective: string;
  interests: string[];
  mix: IExerciseMixItem[];
  minutes: number;
};

const ROADMAP_LEVELS: Array<{
  level: CefrLevel;
  learnerStage: LearnerStage;
  stage: string;
  unit: number;
  lessons: RoadmapLessonTemplate[];
}> = [
  {
    level: "A1",
    learnerStage: "absolute_beginner",
    stage: "Survival launch",
    unit: 1,
    lessons: [
      { title: "Survival sounds and greetings", objective: "Recognize essential greetings, thanks, yes/no, and polite survival words.", interests: ["greetings", "daily life", "communication"], mix: [...choiceAndImageMix, ...beginnerMix], minutes: 8 },
      { title: "People and simple identity", objective: "Use pronouns, names, simple identity phrases, and tiny self-introductions.", interests: ["friends", "communication", "school"], mix: [...beginnerMix, ...choiceAndImageMix], minutes: 9 },
      { title: "Food, water, and daily needs", objective: "Ask for basic things and understand short practical answers.", interests: ["food", "daily life", "travel"], mix: [...beginnerMix, ...choiceAndImageMix], minutes: 9 },
      { title: "Places and directions", objective: "Understand where things are and build first location questions.", interests: ["travel", "transportation", "housing"], mix: [...beginnerMix, { type: "fill_blank", weight: 1, skill: "grammar", difficulty: 2, evaluationMode: "exact", mediaNeeds: "none", templateFamily: "context_gap" }], minutes: 10 },
      { title: "Numbers, time, and tiny plans", objective: "Use numbers, today/tomorrow, time words, and short plan sentences.", interests: ["daily life", "work", "school"], mix: [...beginnerMix, ...choiceAndImageMix], minutes: 10 },
      { title: "First conversations", objective: "Combine greeting, need, place, and time language into short exchanges.", interests: ["communication", "friends", "travel"], mix: [...beginnerMix, ...intermediateMix.slice(0, 1)], minutes: 11 },
      { title: "Home, family, and feelings", objective: "Name close people, rooms, simple feelings, and basic home situations.", interests: ["family", "housing", "emotions"], mix: [...choiceAndImageMix, ...beginnerMix], minutes: 11 },
      { title: "Weather, nature, and weekend words", objective: "Talk about simple weather, outdoor places, and small weekend plans.", interests: ["nature", "daily life", "friends"], mix: [...beginnerMix, ...choiceAndImageMix, ...intermediateMix.slice(0, 1)], minutes: 12 },
    ],
  },
  {
    level: "A2",
    learnerStage: "late_beginner",
    stage: "Everyday operating system",
    unit: 2,
    lessons: [
      { title: "Routines and frequency", objective: "Describe repeated actions, simple schedules, and daily habits.", interests: ["daily life", "fitness", "work"], mix: [...beginnerMix, ...intermediateMix], minutes: 12 },
      { title: "Shopping and requests", objective: "Make practical requests, compare options, and understand prices or quantities.", interests: ["shopping", "food", "money"], mix: [...beginnerMix, ...intermediateMix, ...productionMix.slice(0, 1)], minutes: 12 },
      { title: "Travel and movement", objective: "Ask about transport, routes, times, and simple travel problems.", interests: ["travel", "transportation", "culture"], mix: [...beginnerMix, ...intermediateMix], minutes: 12 },
      { title: "Past experiences", objective: "Talk about what happened and understand short everyday stories.", interests: ["friends", "movies", "music"], mix: [...intermediateMix, ...productionMix.slice(0, 2)], minutes: 13 },
      { title: "Plans and invitations", objective: "Make, accept, and change simple plans with polite language.", interests: ["friends", "communication", "gaming"], mix: [...intermediateMix, ...beginnerMix], minutes: 13 },
      { title: "Everyday problems", objective: "Explain a basic problem, ask for help, and understand a simple solution.", interests: ["health", "travel", "work"], mix: [...intermediateMix, ...productionMix.slice(0, 2)], minutes: 14 },
      { title: "Health, fitness, and moods", objective: "Describe how you feel, basic symptoms, exercise habits, and simple advice.", interests: ["health", "fitness", "emotions"], mix: [...intermediateMix, ...productionMix.slice(0, 2), ...beginnerMix.slice(0, 2)], minutes: 14 },
      { title: "Home services and money", objective: "Handle small payments, appointments, repairs, and practical service conversations.", interests: ["housing", "money", "shopping"], mix: [...intermediateMix, ...productionMix.slice(0, 2), ...beginnerMix], minutes: 15 },
    ],
  },
  {
    level: "B1",
    learnerStage: "intermediate",
    stage: "Independent conversation",
    unit: 3,
    lessons: [
      { title: "Opinions and reasons", objective: "Give a clear opinion and support it with direct reasons.", interests: ["technology", "movies", "culture"], mix: [...intermediateMix, ...productionMix], minutes: 14 },
      { title: "Stories in sequence", objective: "Tell a short story with sequence, contrast, and cause-effect language.", interests: ["friends", "travel", "social media"], mix: [...intermediateMix, ...productionMix], minutes: 14 },
      { title: "Work and study tasks", objective: "Handle common school, university, and workplace tasks with useful precision.", interests: ["work", "school", "university"], mix: [...intermediateMix, ...productionMix], minutes: 15 },
      { title: "Health and advice", objective: "Describe a situation, give advice, and understand recommendations.", interests: ["health", "fitness", "daily life"], mix: [...intermediateMix, ...productionMix], minutes: 15 },
      { title: "Media and culture", objective: "Understand short media texts and react with a personal viewpoint.", interests: ["movies", "music", "culture"], mix: [...intermediateMix, ...productionMix], minutes: 16 },
      { title: "Problem-solving conversations", objective: "Negotiate a practical issue and repair misunderstandings.", interests: ["communication", "work", "travel"], mix: [...intermediateMix, ...productionMix], minutes: 16 },
      { title: "Technology and online life", objective: "Explain simple digital habits, online choices, and communication problems.", interests: ["technology", "social media", "communication"], mix: [...intermediateMix, ...productionMix], minutes: 16 },
      { title: "City, nature, and choices", objective: "Compare places, describe preferences, and justify practical decisions.", interests: ["nature", "transportation", "housing"], mix: [...intermediateMix, ...productionMix, ...advancedMix.slice(0, 1)], minutes: 17 },
    ],
  },
  {
    level: "B2",
    learnerStage: "upper_intermediate",
    stage: "Nuance and extended thought",
    unit: 4,
    lessons: [
      { title: "Nuance and stance", objective: "State a position with hedging, contrast, and controlled certainty.", interests: ["technology", "culture", "business"], mix: [...intermediateMix, ...productionMix, ...advancedMix.slice(0, 1)], minutes: 17 },
      { title: "Evidence and comparison", objective: "Compare sources, weigh evidence, and explain tradeoffs.", interests: ["university", "technology", "design"], mix: [...intermediateMix, ...productionMix, ...advancedMix.slice(0, 1)], minutes: 17 },
      { title: "Negotiation and compromise", objective: "Negotiate choices and respond to disagreement without losing clarity.", interests: ["business", "work", "communication"], mix: [...productionMix, ...intermediateMix], minutes: 18 },
      { title: "Summaries of modern content", objective: "Summarize short modern content and identify the main implication.", interests: ["social media", "movies", "music"], mix: [...intermediateMix, ...advancedMix, ...extendedWritingMix.slice(0, 1)], minutes: 18 },
      { title: "Register and politeness", objective: "Shift between casual, neutral, and professional language.", interests: ["work", "university", "friends"], mix: [...productionMix, ...intermediateMix], minutes: 19 },
      { title: "Longer discussions", objective: "Develop a multi-turn response with examples, contrast, and conclusion.", interests: ["culture", "technology", "business"], mix: [...productionMix, ...advancedMix, ...extendedWritingMix.slice(0, 1)], minutes: 20 },
      { title: "Design critique and creativity", objective: "Evaluate creative choices, explain constraints, and give nuanced feedback.", interests: ["design", "technology", "culture"], mix: [...productionMix, ...intermediateMix, ...advancedMix.slice(0, 2)], minutes: 20 },
      { title: "Money, priorities, and decisions", objective: "Discuss budgets, priorities, risks, and tradeoffs with careful wording.", interests: ["money", "business", "work"], mix: [...productionMix, ...intermediateMix, ...extendedWritingMix.slice(0, 1)], minutes: 21 },
    ],
  },
  {
    level: "C1",
    learnerStage: "advanced",
    stage: "Argument, style, and precision",
    unit: 5,
    lessons: [
      { title: "Argument architecture", objective: "Build a persuasive argument with claims, evidence, concession, and synthesis.", interests: ["university", "business", "culture"], mix: [...advancedMix, ...extendedWritingMix, ...productionMix], minutes: 21 },
      { title: "Style and register", objective: "Control tone, register, and voice across professional and personal contexts.", interests: ["work", "design", "communication"], mix: [...advancedMix, ...extendedWritingMix, ...productionMix], minutes: 21 },
      { title: "Abstract concepts", objective: "Discuss abstract ideas without losing clarity or concrete examples.", interests: ["technology", "culture", "university"], mix: [...advancedMix, ...extendedWritingMix], minutes: 22 },
      { title: "Professional precision", objective: "Write and interpret precise professional language with nuanced constraints.", interests: ["business", "work", "technology"], mix: [...advancedMix, ...extendedWritingMix, ...productionMix], minutes: 22 },
      { title: "Cultural nuance", objective: "Interpret implied meaning, politeness choices, and cultural framing.", interests: ["culture", "movies", "social media"], mix: [...advancedMix, ...extendedWritingMix], minutes: 23 },
      { title: "Synthesis and critique", objective: "Synthesize multiple ideas and write a balanced critical response.", interests: ["university", "business", "design"], mix: [...advancedMix, ...extendedWritingMix], minutes: 24 },
      { title: "Research, evidence, and uncertainty", objective: "Weigh evidence, state uncertainty, and synthesize a careful conclusion.", interests: ["university", "technology", "health"], mix: [...advancedMix, ...extendedWritingMix, ...productionMix], minutes: 24 },
      { title: "Leadership and negotiation", objective: "Navigate disagreement, propose compromises, and maintain professional tone.", interests: ["business", "work", "communication"], mix: [...advancedMix, ...extendedWritingMix, ...productionMix], minutes: 25 },
    ],
  },
  {
    level: "C2",
    learnerStage: "advanced",
    stage: "Near-native control",
    unit: 6,
    lessons: [
      { title: "Near-native idiom control", objective: "Use idiomatic language precisely without sounding memorized.", interests: ["culture", "communication", "movies"], mix: [...advancedMix, ...extendedWritingMix], minutes: 24 },
      { title: "Subtle implication", objective: "Recognize subtext, implication, understatement, and rhetorical framing.", interests: ["business", "culture", "university"], mix: [...advancedMix, ...extendedWritingMix], minutes: 25 },
      { title: "Rhetorical precision", objective: "Choose wording for persuasive effect, emphasis, and audience fit.", interests: ["business", "social media", "design"], mix: [...advancedMix, ...extendedWritingMix], minutes: 25 },
      { title: "Dense text navigation", objective: "Unpack dense texts and restate them with cleaner structure.", interests: ["university", "technology", "culture"], mix: [...advancedMix, ...extendedWritingMix], minutes: 26 },
      { title: "Debate and rebuttal", objective: "Respond to complex arguments with measured rebuttals and concessions.", interests: ["business", "university", "technology"], mix: [...advancedMix, ...extendedWritingMix], minutes: 26 },
      { title: "Voice polish", objective: "Polish voice, rhythm, and precision for near-native written output.", interests: ["design", "culture", "communication"], mix: [...advancedMix, ...extendedWritingMix], minutes: 27 },
      { title: "Editing for style and rhythm", objective: "Revise dense or awkward writing for tone, rhythm, precision, and audience.", interests: ["design", "social media", "work"], mix: [...advancedMix, ...extendedWritingMix, ...productionMix.slice(1)], minutes: 27 },
      { title: "Interdisciplinary synthesis", objective: "Connect ideas across culture, technology, work, and society with subtle control.", interests: ["culture", "technology", "business"], mix: [...advancedMix, ...extendedWritingMix], minutes: 28 },
    ],
  },
];

function nodeKey(language: string, level: CefrLevel, unit: number, lesson: number) {
  return `${language}:${level}:u${unit}:l${lesson}`;
}

function makeNode(params: {
  language: string;
  level: CefrLevel;
  learnerStage: LearnerStage;
  stage: string;
  stageOrder: number;
  unit: number;
  lesson: number;
  title: string;
  objective: string;
  description?: string;
  scriptFocus?: ScriptStage;
  exerciseMix: IExerciseMixItem[];
  vocabulary: string[];
  grammar: string[];
  interests?: string[];
  minutes?: number;
  previous?: string[];
}): CurriculumSeed {
  return {
    nodeKey: nodeKey(params.language, params.level, params.unit, params.lesson),
    language: params.language,
    level: params.level,
    learnerStage: params.learnerStage,
    stage: params.stage,
    stageOrder: params.stageOrder,
    unit: params.unit,
    lesson: params.lesson,
    title: params.title,
    objective: params.objective,
    description: params.description,
    unlockCriteria: {
      previousNodeIds: params.previous ?? [],
      minScore: params.previous?.length ? 0.7 : undefined,
      minIntroducedWords: params.previous?.length ? 4 : undefined,
    },
    skillFocus: [...new Set(params.exerciseMix.map((item) => item.skill))],
    scriptFocus: params.scriptFocus,
    exerciseMix: params.exerciseMix,
    recommendedVocabulary: params.vocabulary,
    grammarTargets: params.grammar,
    interestTags: params.interests ?? ["daily life", "communication"],
    estimatedMinutes: params.minutes ?? 8,
  };
}

function pickLessonVocabulary(words: string[], lessonIndex: number) {
  if (words.length <= 8) return words;
  const start = (lessonIndex * 4) % words.length;
  return Array.from({ length: 8 }, (_, index) => words[(start + index) % words.length]);
}

function pickLessonGrammar(level: CefrLevel, lessonIndex: number) {
  const items = LEVEL_GRAMMAR[level];
  return Array.from({ length: 3 }, (_, index) => items[(lessonIndex + index) % items.length]);
}

function getLearnerStageForLesson(
  level: CefrLevel,
  lessonIndex: number,
  fallback: LearnerStage
): LearnerStage {
  if (level !== "A1") return fallback;
  if (lessonIndex <= 1) return "absolute_beginner";
  if (lessonIndex <= 3) return "early_beginner";
  return "late_beginner";
}

function getScriptFocus(language: string, level: CefrLevel, lessonIndex: number): ScriptStage {
  if (language === "ja") {
    if (level === "A1" && lessonIndex === 0) return "romaji";
    if (level === "A1" && lessonIndex <= 2) return "kana_intro";
    if (level === "A1") return "kana_supported";
    if (level === "A2" && lessonIndex <= 1) return "kana_confident";
    if (level === "A2" || level === "B1") return "kanji_intro";
    if (level === "B2") return "kanji_supported";
    return "kanji_confident";
  }

  if (["zh", "ko"].includes(language)) return "native_script";
  return "latin";
}

function withLanguageExerciseSupport(
  language: string,
  level: CefrLevel,
  lessonIndex: number,
  mix: IExerciseMixItem[]
): IExerciseMixItem[] {
  const needsScriptPractice =
    ["ja", "zh", "ko"].includes(language) && (level === "A1" || level === "A2" || lessonIndex === 0);
  if (!needsScriptPractice) return mix;

  const scriptMix: IExerciseMixItem[] = [
    {
      type: "script_recognition",
      weight: 1,
      skill: "script",
      difficulty: level === "A1" ? 1 : 2,
      evaluationMode: "exact",
      mediaNeeds: "none",
      templateFamily: "script_bridge",
    },
    {
      type: "reading_association",
      weight: 1,
      skill: "script",
      difficulty: level === "A1" ? 2 : 3,
      evaluationMode: "exact",
      mediaNeeds: "none",
      templateFamily: "reading_bridge",
    },
  ];

  return [...mix, ...scriptMix.filter((item) => !mix.some((existing) => existing.type === item.type))];
}

function getLanguageLearningDescription(language: string, level: CefrLevel) {
  if (language === "ja") {
    return "Stage-aware Japanese path with gradual romaji, kana, and kanji support.";
  }

  if (language === "zh") {
    return "Character-first Mandarin path with recognition, reading association, and practical production.";
  }

  if (language === "ko") {
    return "Hangul-native Korean path with early script recognition and sentence-pattern practice.";
  }

  if (level === "C1" || level === "C2") {
    return "Advanced path focused on register, precision, argument, and near-native control.";
  }

  return "CEFR-aligned path with vocabulary, grammar, reading, and writing practice balanced for this level.";
}

export function getDefaultCurriculum(languageInput = "en"): CurriculumSeed[] {
  const language = normalizeLanguageCode(languageInput, "en");
  const profile = LANGUAGE_VOCABULARY[language] ?? LANGUAGE_VOCABULARY.en;
  const nodes: CurriculumSeed[] = [];
  let previousKey: string | undefined;

  for (const [levelIndex, levelPlan] of ROADMAP_LEVELS.entries()) {
    for (const [lessonIndex, lesson] of levelPlan.lessons.entries()) {
      const lessonNumber = lessonIndex + 1;
      const vocabulary = pickLessonVocabulary(profile[levelPlan.level], lessonIndex);
      const grammar = pickLessonGrammar(levelPlan.level, lessonIndex);

      nodes.push(
        makeNode({
          language,
          level: levelPlan.level,
          learnerStage: getLearnerStageForLesson(levelPlan.level, lessonIndex, levelPlan.learnerStage),
          stage: levelPlan.stage,
          stageOrder: levelIndex * 100 + lessonNumber * 10,
          unit: levelPlan.unit,
          lesson: lessonNumber,
          title: lesson.title,
          objective: lesson.objective,
          description: getLanguageLearningDescription(language, levelPlan.level),
          scriptFocus: getScriptFocus(language, levelPlan.level, lessonIndex),
          exerciseMix: withLanguageExerciseSupport(language, levelPlan.level, lessonIndex, lesson.mix),
          vocabulary,
          grammar,
          interests: lesson.interests,
          minutes: lesson.minutes,
          previous: previousKey ? [previousKey] : [],
        })
      );

      previousKey = nodeKey(language, levelPlan.level, levelPlan.unit, lessonNumber);
    }
  }

  return nodes;
}

const WORD_SEEDS: WordSeed[] = [
  {
    word: "hello",
    translation: "hello / greeting",
    definition: "A greeting used when meeting someone.",
    partOfSpeech: "INTERJECTION",
    cefrLevel: "A1",
    topic: "greetings",
    exampleSentence: "Hello, I am Sam.",
    easierExplanation: "Use this when you meet someone.",
    synonyms: ["hi"],
    collocations: ["say hello"],
    pronunciation: "heh-LOH",
    language: "en",
    nativeLanguage: "en",
    explanationLanguage: "en",
    sourceType: "seed",
    generatedBy: "system",
    lessonStep: "introduction",
    progressionStep: 1,
    scriptStage: "latin",
    interestTags: ["daily life", "creators"],
    grammarTags: ["greeting"],
  },
  {
    word: "water",
    translation: "water",
    definition: "A clear liquid that people drink.",
    partOfSpeech: "NOUN",
    cefrLevel: "A1",
    topic: "daily life",
    exampleSentence: "I want water, please.",
    easierExplanation: "Something you drink.",
    synonyms: [],
    collocations: ["drink water"],
    pronunciation: "WAW-ter",
    language: "en",
    nativeLanguage: "en",
    explanationLanguage: "en",
    sourceType: "seed",
    generatedBy: "system",
    lessonStep: "introduction",
    progressionStep: 1,
    scriptStage: "latin",
    interestTags: ["daily life", "fitness"],
    grammarTags: ["noun"],
  },
  {
    word: "konnichiwa",
    translation: "hello",
    definition: "A common Japanese greeting.",
    partOfSpeech: "INTERJECTION",
    cefrLevel: "A1",
    topic: "greetings",
    exampleSentence: "Konnichiwa. Watashi wa Ana desu.",
    easierExplanation: "Use it to say hello during the day.",
    synonyms: ["こんにちは"],
    collocations: ["konnichiwa, watashi wa"],
    pronunciation: "koh-nee-chee-wah",
    language: "ja",
    nativeLanguage: "en",
    explanationLanguage: "en",
    sourceType: "seed",
    generatedBy: "system",
    lessonStep: "introduction",
    progressionStep: 1,
    scriptStage: "romaji",
    interestTags: ["anime", "daily life"],
    grammarTags: ["greeting"],
  },
  {
    word: "arigato",
    translation: "thank you",
    definition: "A common way to say thanks in Japanese.",
    partOfSpeech: "INTERJECTION",
    cefrLevel: "A1",
    topic: "greetings",
    exampleSentence: "Arigato.",
    easierExplanation: "Say this when someone helps you.",
    synonyms: ["ありがとう"],
    collocations: ["arigato gozaimasu"],
    pronunciation: "ah-ree-gah-toh",
    language: "ja",
    nativeLanguage: "en",
    explanationLanguage: "en",
    sourceType: "seed",
    generatedBy: "system",
    lessonStep: "introduction",
    progressionStep: 1,
    scriptStage: "romaji",
    interestTags: ["anime", "creators"],
    grammarTags: ["politeness"],
  },
];

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const YOUTUBE_SOURCE_URL_PATTERN = /(?:youtube\.com|youtu\.be)/i;

function getAlignedVocabularyTranslation(word: string, targetLanguage: string, nativeLanguage: string) {
  const targetVocabulary = LANGUAGE_VOCABULARY[targetLanguage];
  if (!targetVocabulary) return "";

  const normalizedWord = word.trim().toLowerCase();
  const nativeVocabulary = LANGUAGE_VOCABULARY[nativeLanguage] ?? LANGUAGE_VOCABULARY.en;
  const englishVocabulary = LANGUAGE_VOCABULARY.en;

  for (const level of CEFR_LEVELS) {
    const index = targetVocabulary[level].findIndex((item) => item.toLowerCase() === normalizedWord);
    if (index < 0) continue;

    return nativeVocabulary?.[level]?.[index] ?? englishVocabulary[level]?.[index] ?? "";
  }

  return "";
}

export function getSeedFallbackTranslation(word: string, targetLanguage: string, nativeLanguage: string) {
  const cleanWord = word.trim();
  if (!cleanWord) return "";

  const language = normalizeLanguageCode(targetLanguage, "en");
  const native = normalizeLanguageCode(nativeLanguage, "en");
  if (language === native) return cleanWord;

  const alignedTranslation = getAlignedVocabularyTranslation(cleanWord, language, native);
  if (alignedTranslation) return alignedTranslation;

  const map: Record<string, Record<string, string>> = {
    hello: { en: "hello", ru: "привет" },
    thanks: { en: "thanks", ru: "спасибо" },
    please: { en: "please", ru: "пожалуйста" },
    yes: { en: "yes", ru: "да" },
    no: { en: "no", ru: "нет" },
    water: { en: "water", ru: "вода" },
    konnichiwa: { en: "hello", ru: "привет" },
    arigato: { en: "thank you", ru: "спасибо" },
    hai: { en: "yes", ru: "да" },
    iie: { en: "no", ru: "нет" },
    mizu: { en: "water", ru: "вода" },
    onegaishimasu: { en: "please", ru: "пожалуйста" },
  };

  return map[cleanWord.toLowerCase()]?.[native] ?? map[cleanWord.toLowerCase()]?.en ?? cleanWord;
}

function translateFallback(word: string, targetLanguage: string, nativeLanguage: string) {
  return getSeedFallbackTranslation(word, targetLanguage, nativeLanguage);
}

export async function ensureWordsForNode(params: {
  language: string;
  nativeLanguage: string;
  node: Pick<
    ICurriculumNode,
    "nodeKey" | "_id" | "level" | "recommendedVocabulary" | "interestTags" | "scriptFocus" | "grammarTargets"
  >;
}): Promise<IVocabularyWord[]> {
  const language = normalizeLanguageCode(params.language, "en");
  const nativeLanguage = normalizeLanguageCode(params.nativeLanguage, "ru");
  const ids: string[] = [];

  for (const [index, rawWord] of params.node.recommendedVocabulary.entries()) {
    const word = rawWord.trim();
    if (!word) continue;
    const existingSeed = WORD_SEEDS.find(
      (item) => item.word.toLowerCase() === word.toLowerCase() && item.language === language
    );
    const document = await VocabularyWord.findOneAndUpdate(
      {
        word,
        language,
        nativeLanguage,
        cefrLevel: params.node.level,
        sourceType: "seed",
      },
      {
        $set: {
          translation:
            nativeLanguage === existingSeed?.nativeLanguage
              ? existingSeed.translation
              : translateFallback(word, language, nativeLanguage),
          definition: existingSeed?.definition ?? `A ${params.node.level} ${language} word for guided lessons.`,
          partOfSpeech: existingSeed?.partOfSpeech ?? ("PHRASE" as PartOfSpeech),
          topic: existingSeed?.topic ?? params.node.interestTags[0] ?? "daily life",
          exampleSentence: existingSeed?.exampleSentence ?? `${word}.`,
          easierExplanation: existingSeed?.easierExplanation ?? `A useful word for this lesson.`,
          synonyms: existingSeed?.synonyms ?? [],
          collocations: existingSeed?.collocations ?? [],
          pronunciation: existingSeed?.pronunciation ?? "",
          explanationLanguage: nativeLanguage,
          generatedBy: "system",
          lessonStep: index < 3 ? "introduction" : "recognition",
          progressionStep: Math.min(index + 1, 10),
          roadmapNodeIds: [String(params.node._id)],
          scriptStage: existingSeed?.scriptStage ?? params.node.scriptFocus ?? "latin",
          interestTags: [...new Set([...(existingSeed?.interestTags ?? []), ...params.node.interestTags])],
          grammarTags: params.node.grammarTargets,
        },
        $setOnInsert: {
          word,
          language,
          nativeLanguage,
          cefrLevel: params.node.level,
          sourceType: "seed",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ids.push(String(document._id));
  }

  return (await VocabularyWord.find({ _id: { $in: ids } }).lean({
    virtuals: true,
  })) as unknown as IVocabularyWord[];
}

export async function seedLearningFoundation(languageInput?: string) {
  const languages: string[] = languageInput
    ? [normalizeLanguageCode(languageInput, "en")]
    : [...SUPPORTED_CURRICULUM_LANGUAGES];
  let curriculumCount = 0;
  let mediaCount = 0;
  let removedMediaCount = 0;
  let wordCount = 0;

  for (const language of languages) {
    const curriculum = getDefaultCurriculum(language);
    await CurriculumNode.updateMany(
      { language, nodeKey: { $nin: curriculum.map((node) => node.nodeKey) } },
      { $set: { isActive: false } }
    );

    for (const node of curriculum) {
      await CurriculumNode.findOneAndUpdate(
        { nodeKey: node.nodeKey },
        {
          $set: {
            ...node,
            unlockCriteria: node.unlockCriteria ?? { previousNodeIds: [] },
            isActive: true,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      curriculumCount += 1;
    }
  }

  for (const word of WORD_SEEDS.filter((seed) => languages.includes(seed.language))) {
    await VocabularyWord.findOneAndUpdate(
      {
        word: word.word,
        language: word.language,
        nativeLanguage: word.nativeLanguage,
        cefrLevel: word.cefrLevel,
        sourceType: "seed",
      },
      { $set: word },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    wordCount += 1;
  }

  const mediaSeeds = CURATED_MEDIA_TASKS.filter(
    (task) =>
      languages.includes(task.language) &&
      task.provider !== "youtube" &&
      !YOUTUBE_SOURCE_URL_PATTERN.test(task.sourceUrl)
  );
  const removedMedia = await MediaTask.deleteMany({
    language: { $in: languages },
    $or: [
      { provider: "youtube" },
      { sourceUrl: YOUTUBE_SOURCE_URL_PATTERN },
    ],
  });
  removedMediaCount = removedMedia.deletedCount ?? 0;

  for (const media of mediaSeeds) {
    await MediaTask.findOneAndUpdate(
      { _id: media._id },
      { $set: media },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    mediaCount += 1;
  }

  return { curriculumCount, mediaCount, removedMediaCount, wordCount };
}
