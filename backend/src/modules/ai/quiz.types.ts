import type { ExerciseType } from "../learning/exerciseCatalog";
import type { EvaluationMode, SkillFocus } from "../../models";

export interface QuizWordInfo {
  word: string;
  translation: string;
  definition: string;
  exampleSentence: string;
}

interface BaseQuizQuestion {
  type: ExerciseType;
  question: string;
  wordId: string;
  questionHash: string;
  wordInfo?: QuizWordInfo;
  roadmapNodeId?: string;
  exerciseMeta?: {
    skill: SkillFocus;
    difficulty: number;
    stageSuitability: string[];
    evaluationMode: EvaluationMode;
    mediaNeeds: "none" | "image" | "audio" | "video";
    templateFamily: string;
  };
  scriptSupport?: {
    scriptStage: string;
    displayText?: string;
    reading?: string;
    romaji?: string;
  };
}

export interface MultipleChoiceQuizQuestion extends BaseQuizQuestion {
  type: "multiple_choice";
  options: string[];
  correctAnswer: string;
}

export interface FillBlankQuizQuestion extends BaseQuizQuestion {
  type: "fill_blank";
  sentence: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
}

export interface TranslationInputQuizQuestion extends BaseQuizQuestion {
  type: "translation_input";
  promptWord: string;
  correctAnswer: string;
  acceptedAnswers: string[];
}

export interface ReverseMultipleChoiceQuizQuestion extends BaseQuizQuestion {
  type: "reverse_multiple_choice";
  promptTranslation: string;
  options: string[];
  correctAnswer: string;
}

export interface SentenceWritingQuizQuestion extends BaseQuizQuestion {
  type: "sentence_writing";
  targetWord: string;
  minWords: number;
  keywordHints: string[];
  instructions: string[];
  helpfulTips: string[];
  sampleAnswer?: string;
}

export interface QuizAnswerRuleCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export type QuizEvaluationStatus = "correct" | "incorrect" | "pending_review";

export interface QuizAnswerEvaluation {
  questionType: QuizQuestion["type"];
  status: QuizEvaluationStatus;
  correct: boolean;
  feedback: string;
  correctAnswer?: string;
  acceptedEquivalent?: string;
  hasMistakes?: boolean;
  correctedAnswer?: string;
  ruleChecks?: QuizAnswerRuleCheck[];
 }

export interface ImageBasedQuizQuestion extends BaseQuizQuestion {
  type: "image_based";
  imageUrl?: string;
  correctAnswer: string;
  acceptedAnswers: string[];
  options?: string[];
}

export interface ReorderWordsQuizQuestion extends BaseQuizQuestion {
  type: "reorder_words";
  tokens: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
}

export interface MatchingQuizQuestion extends BaseQuizQuestion {
  type: "matching";
  pairs: Array<{ left: string; right: string }>;
  options: string[];
  correctAnswer: string;
}

export interface ScriptRecognitionQuizQuestion extends BaseQuizQuestion {
  type: "script_recognition" | "reading_association";
  promptText: string;
  reading?: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
}

export interface ReadingComprehensionQuizQuestion extends BaseQuizQuestion {
  type: "reading_comprehension" | "paraphrase_choice" | "media_comprehension";
  media?: {
    sourceUrl: string;
    provider: "youtube" | "external";
    clipTitle: string;
    startSeconds: number;
    endSeconds: number;
  };
  passage: string;
  options: string[];
  correctAnswer: string;
}

export interface ErrorCorrectionQuizQuestion extends BaseQuizQuestion {
  type: "error_correction";
  sentence: string;
  incorrectSegment?: string;
  correctAnswer: string;
  acceptedAnswers: string[];
}

export interface OpenWritingQuizQuestion extends BaseQuizQuestion {
  type:
    | "open_translation"
    | "translation_variants"
    | "short_paragraph_response"
    | "summary"
    | "argument_response"
    | "essay_writing";
  prompt: string;
  minWords: number;
  rubric: string[];
  sampleAnswer?: string;
}

export interface MediaExerciseQuestion extends BaseQuizQuestion {
  type: "transcript_gap_fill" | "media_transcript";
  media: {
    sourceUrl: string;
    provider: "youtube" | "external";
    clipTitle: string;
    startSeconds: number;
    endSeconds: number;
  };
  transcriptWithBlank?: string;
  promptText?: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
}

export interface GenericChoiceQuizQuestion extends BaseQuizQuestion {
  type:
    | "word_to_picture"
    | "picture_to_word"
    | "tap_translation"
    | "tap_heard_phrase"
    | "choose_missing_word"
    | "fill_in_context"
    | "short_dictation";
  promptText?: string;
  sentence?: string;
  imageUrl?: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
}

export type QuizQuestion =
  | MultipleChoiceQuizQuestion
  | FillBlankQuizQuestion
  | ReverseMultipleChoiceQuizQuestion
  | TranslationInputQuizQuestion
  | SentenceWritingQuizQuestion
  | ImageBasedQuizQuestion
  | ReorderWordsQuizQuestion
  | MatchingQuizQuestion
  | ScriptRecognitionQuizQuestion
  | ReadingComprehensionQuizQuestion
  | ErrorCorrectionQuizQuestion
  | OpenWritingQuizQuestion
  | MediaExerciseQuestion
  | GenericChoiceQuizQuestion;

// acceptedAnswers and sampleAnswer are stripped to avoid leaking answer variants and model answers.
// correctAnswer is intentionally kept: for choice-based questions it is already visible as one
// of the options, and the frontend needs it to highlight the correct option after a wrong response.
type StripAnswerFields<T> = Omit<T, "acceptedAnswers" | "sampleAnswer">;

export type PublicQuizQuestion =
  | StripAnswerFields<MultipleChoiceQuizQuestion>
  | StripAnswerFields<FillBlankQuizQuestion>
  | StripAnswerFields<ReverseMultipleChoiceQuizQuestion>
  | StripAnswerFields<TranslationInputQuizQuestion>
  | StripAnswerFields<SentenceWritingQuizQuestion>
  | StripAnswerFields<ImageBasedQuizQuestion>
  | StripAnswerFields<ReorderWordsQuizQuestion>
  | StripAnswerFields<MatchingQuizQuestion>
  | StripAnswerFields<ScriptRecognitionQuizQuestion>
  | StripAnswerFields<ReadingComprehensionQuizQuestion>
  | StripAnswerFields<ErrorCorrectionQuizQuestion>
  | StripAnswerFields<OpenWritingQuizQuestion>
  | StripAnswerFields<MediaExerciseQuestion>
  | StripAnswerFields<GenericChoiceQuizQuestion>;
