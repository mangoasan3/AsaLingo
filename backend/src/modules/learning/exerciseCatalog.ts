import type { CefrLevel, LearnerStage, ScriptStage } from "../../models";
import type { EvaluationMode, SkillFocus } from "../../models/CurriculumNode";

export type ExerciseType =
  | "multiple_choice"
  | "fill_blank"
  | "reverse_multiple_choice"
  | "translation_input"
  | "sentence_writing"
  | "image_based"
  | "word_to_picture"
  | "picture_to_word"
  | "tap_translation"
  | "tap_heard_phrase"
  | "reorder_words"
  | "choose_missing_word"
  | "matching"
  | "script_recognition"
  | "reading_association"
  | "fill_in_context"
  | "paraphrase_choice"
  | "translation_variants"
  | "short_dictation"
  | "transcript_gap_fill"
  | "reading_comprehension"
  | "error_correction"
  | "open_translation"
  | "short_paragraph_response"
  | "summary"
  | "argument_response"
  | "essay_writing"
  | "media_transcript"
  | "media_comprehension";

export interface ExerciseMetadata {
  type: ExerciseType;
  label: string;
  skill: SkillFocus;
  minLevel: CefrLevel;
  maxLevel?: CefrLevel;
  suitableStages: LearnerStage[];
  evaluationMode: EvaluationMode;
  mediaNeeds: "none" | "image" | "audio" | "video";
  defaultDifficulty: number;
  templateFamily: string;
  scriptStages?: ScriptStage[];
}

const LEVEL_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export const EXERCISE_CATALOG: Record<ExerciseType, ExerciseMetadata> = {
  multiple_choice: {
    type: "multiple_choice",
    label: "Meaning choice",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner", "intermediate"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 1,
    templateFamily: "recognition_choice",
  },
  fill_blank: {
    type: "fill_blank",
    label: "Missing word",
    skill: "grammar",
    minLevel: "A1",
    suitableStages: ["early_beginner", "late_beginner", "intermediate", "upper_intermediate"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 2,
    templateFamily: "context_gap",
  },
  reverse_multiple_choice: {
    type: "reverse_multiple_choice",
    label: "Translation to word",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner", "intermediate"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 1,
    templateFamily: "reverse_choice",
  },
  translation_input: {
    type: "translation_input",
    label: "Typed translation",
    skill: "writing",
    minLevel: "A2",
    suitableStages: ["late_beginner", "intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "ai",
    mediaNeeds: "none",
    defaultDifficulty: 3,
    templateFamily: "typed_translation",
  },
  sentence_writing: {
    type: "sentence_writing",
    label: "Sentence writing",
    skill: "writing",
    minLevel: "B1",
    suitableStages: ["intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "rubric",
    mediaNeeds: "none",
    defaultDifficulty: 4,
    templateFamily: "controlled_writing",
  },
  image_based: {
    type: "image_based",
    label: "Image prompt",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "image",
    defaultDifficulty: 1,
    templateFamily: "image_recognition",
  },
  word_to_picture: {
    type: "word_to_picture",
    label: "Word to picture",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "image",
    defaultDifficulty: 1,
    templateFamily: "playful_picture_choice",
  },
  picture_to_word: {
    type: "picture_to_word",
    label: "Picture to word",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "image",
    defaultDifficulty: 1,
    templateFamily: "picture_word_choice",
  },
  tap_translation: {
    type: "tap_translation",
    label: "Tap translation",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 1,
    templateFamily: "fast_tap",
  },
  tap_heard_phrase: {
    type: "tap_heard_phrase",
    label: "Tap heard phrase",
    skill: "listening",
    minLevel: "A1",
    suitableStages: ["early_beginner", "late_beginner", "intermediate"],
    evaluationMode: "exact",
    mediaNeeds: "audio",
    defaultDifficulty: 2,
    templateFamily: "audio_ready_choice",
  },
  reorder_words: {
    type: "reorder_words",
    label: "Sentence builder",
    skill: "grammar",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 2,
    templateFamily: "sentence_order",
  },
  choose_missing_word: {
    type: "choose_missing_word",
    label: "Choose missing word",
    skill: "grammar",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner", "intermediate"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 2,
    templateFamily: "guided_gap_choice",
  },
  matching: {
    type: "matching",
    label: "Matching",
    skill: "vocabulary",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner", "late_beginner"],
    evaluationMode: "auto",
    mediaNeeds: "none",
    defaultDifficulty: 1,
    templateFamily: "pair_matching",
  },
  script_recognition: {
    type: "script_recognition",
    label: "Script recognition",
    skill: "script",
    minLevel: "A1",
    suitableStages: ["absolute_beginner", "early_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 1,
    templateFamily: "script_bridge",
    scriptStages: ["romaji", "kana_intro", "kana_supported", "kana_confident", "native_script"],
  },
  reading_association: {
    type: "reading_association",
    label: "Reading association",
    skill: "script",
    minLevel: "A1",
    suitableStages: ["early_beginner", "late_beginner"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 2,
    templateFamily: "reading_bridge",
    scriptStages: ["kana_intro", "kana_supported", "kanji_intro", "kanji_supported", "native_script"],
  },
  fill_in_context: {
    type: "fill_in_context",
    label: "Fill in context",
    skill: "grammar",
    minLevel: "A2",
    suitableStages: ["late_beginner", "intermediate", "upper_intermediate"],
    evaluationMode: "auto",
    mediaNeeds: "none",
    defaultDifficulty: 3,
    templateFamily: "contextual_gap",
  },
  paraphrase_choice: {
    type: "paraphrase_choice",
    label: "Paraphrase choice",
    skill: "reading",
    minLevel: "B1",
    suitableStages: ["intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 3,
    templateFamily: "meaning_paraphrase",
  },
  translation_variants: {
    type: "translation_variants",
    label: "Translation variants",
    skill: "writing",
    minLevel: "B1",
    suitableStages: ["intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "ai",
    mediaNeeds: "none",
    defaultDifficulty: 4,
    templateFamily: "variant_translation",
  },
  short_dictation: {
    type: "short_dictation",
    label: "Short dictation",
    skill: "listening",
    minLevel: "A2",
    suitableStages: ["late_beginner", "intermediate", "upper_intermediate"],
    evaluationMode: "auto",
    mediaNeeds: "audio",
    defaultDifficulty: 3,
    templateFamily: "audio_ready_dictation",
  },
  transcript_gap_fill: {
    type: "transcript_gap_fill",
    label: "Transcript gap fill",
    skill: "listening",
    minLevel: "A2",
    suitableStages: ["late_beginner", "intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "auto",
    mediaNeeds: "video",
    defaultDifficulty: 3,
    templateFamily: "curated_media_gap",
  },
  reading_comprehension: {
    type: "reading_comprehension",
    label: "Micro reading",
    skill: "reading",
    minLevel: "A2",
    suitableStages: ["late_beginner", "intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "exact",
    mediaNeeds: "none",
    defaultDifficulty: 3,
    templateFamily: "micro_reading",
  },
  error_correction: {
    type: "error_correction",
    label: "Error correction",
    skill: "grammar",
    minLevel: "B1",
    suitableStages: ["intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "ai",
    mediaNeeds: "none",
    defaultDifficulty: 4,
    templateFamily: "grammar_repair",
  },
  open_translation: {
    type: "open_translation",
    label: "Open translation",
    skill: "writing",
    minLevel: "B1",
    suitableStages: ["intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "ai",
    mediaNeeds: "none",
    defaultDifficulty: 4,
    templateFamily: "open_translation",
  },
  short_paragraph_response: {
    type: "short_paragraph_response",
    label: "Short response",
    skill: "writing",
    minLevel: "B2",
    suitableStages: ["upper_intermediate", "advanced"],
    evaluationMode: "rubric",
    mediaNeeds: "none",
    defaultDifficulty: 5,
    templateFamily: "paragraph_response",
  },
  summary: {
    type: "summary",
    label: "Summary",
    skill: "writing",
    minLevel: "B2",
    suitableStages: ["upper_intermediate", "advanced"],
    evaluationMode: "rubric",
    mediaNeeds: "none",
    defaultDifficulty: 5,
    templateFamily: "summarization",
  },
  argument_response: {
    type: "argument_response",
    label: "Argument response",
    skill: "writing",
    minLevel: "C1",
    suitableStages: ["advanced"],
    evaluationMode: "rubric",
    mediaNeeds: "none",
    defaultDifficulty: 6,
    templateFamily: "argument_writing",
  },
  essay_writing: {
    type: "essay_writing",
    label: "Essay writing",
    skill: "writing",
    minLevel: "C1",
    suitableStages: ["advanced"],
    evaluationMode: "rubric",
    mediaNeeds: "none",
    defaultDifficulty: 6,
    templateFamily: "extended_writing",
  },
  media_transcript: {
    type: "media_transcript",
    label: "Media transcript",
    skill: "listening",
    minLevel: "A2",
    suitableStages: ["late_beginner", "intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "auto",
    mediaNeeds: "video",
    defaultDifficulty: 3,
    templateFamily: "curated_media_transcript",
  },
  media_comprehension: {
    type: "media_comprehension",
    label: "Media comprehension",
    skill: "listening",
    minLevel: "B1",
    suitableStages: ["intermediate", "upper_intermediate", "advanced"],
    evaluationMode: "exact",
    mediaNeeds: "video",
    defaultDifficulty: 4,
    templateFamily: "curated_media_comprehension",
  },
};

export const ALL_EXERCISE_TYPES = Object.keys(EXERCISE_CATALOG) as ExerciseType[];

export function getExerciseMetadata(type: string): ExerciseMetadata {
  return EXERCISE_CATALOG[type as ExerciseType] ?? EXERCISE_CATALOG.multiple_choice;
}

export function isExerciseSuitable(params: {
  type: ExerciseType;
  level: CefrLevel;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
}) {
  const metadata = EXERCISE_CATALOG[params.type];
  if (LEVEL_RANK[metadata.minLevel] > LEVEL_RANK[params.level]) return false;
  if (metadata.maxLevel && LEVEL_RANK[metadata.maxLevel] < LEVEL_RANK[params.level]) return false;
  if (!metadata.suitableStages.includes(params.learnerStage)) return false;
  if (metadata.scriptStages && !metadata.scriptStages.includes(params.scriptStage)) return false;
  return true;
}

export function getRecommendedExerciseTypes(params: {
  level: CefrLevel;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
  language: string;
  limit?: number;
}): ExerciseType[] {
  const candidates = ALL_EXERCISE_TYPES.filter((type) =>
    isExerciseSuitable({
      type,
      level: params.level,
      learnerStage: params.learnerStage,
      scriptStage: params.scriptStage,
    })
  ).filter((type) => {
    if (EXERCISE_CATALOG[type].skill === "script") return ["ja", "zh", "ko"].includes(params.language);
    if (EXERCISE_CATALOG[type].mediaNeeds === "audio") return false;
    return true;
  });

  return candidates.slice(0, params.limit ?? 8);
}
