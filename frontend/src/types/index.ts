export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type WordStatus = "NEW" | "LEARNING" | "LEARNED" | "DIFFICULT" | "SAVED";
export type AuthProvider = "EMAIL" | "GOOGLE";
export type PlacementSource = "manual" | "placement_test";
export type LearnerStage =
  | "absolute_beginner"
  | "early_beginner"
  | "late_beginner"
  | "intermediate"
  | "upper_intermediate"
  | "advanced";
export type ScriptStage =
  | "latin"
  | "romaji"
  | "kana_intro"
  | "kana_supported"
  | "kana_confident"
  | "kanji_intro"
  | "kanji_supported"
  | "kanji_confident"
  | "native_script";
export type ContentStyle = "playful" | "balanced" | "practical" | "academic" | "challenge";
export type PartOfSpeech =
  | "NOUN" | "VERB" | "ADJECTIVE" | "ADVERB" | "PREPOSITION"
  | "CONJUNCTION" | "PRONOUN" | "INTERJECTION" | "PHRASE";

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

export interface SubskillProfile {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
  writing: number;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  authProvider: AuthProvider;
  avatar?: string;
  studyLanguage: string;
  nativeLanguage: string;
  currentLevel: CefrLevel;
  placementSource: PlacementSource;
  placementConfidence: number;
  subskillProfile: SubskillProfile;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
  learningGoal?: string;
  interests: string[];
  preferredContentStyle: ContentStyle;
  currentRoadmapNodeId?: string;
  onboardingVersion: "legacy" | "learning_v1";
  onboardingDone: boolean;
  streak: number;
  lastStudiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyWord {
  id: string;
  _id?: string;
  word: string;
  translation: string;
  definition: string;
  partOfSpeech: PartOfSpeech;
  cefrLevel: CefrLevel;
  topic?: string;
  exampleSentence: string;
  easierExplanation?: string;
  synonyms: string[];
  collocations: string[];
  pronunciation?: string;
  language: string;
  nativeLanguage: string;
  explanationLanguage?: string;
  sourceType?: "ai-generated" | "seed";
  generatedBy?: "deepseek" | "system";
  roadmapNodeIds?: string[];
  scriptStage?: string;
  interestTags?: string[];
  grammarTags?: string[];
  createdAt: string;
}

export interface UserWord {
  id: string;
  userId: string;
  wordId: string;
  status: WordStatus;
  timesReviewed: number;
  correctCount: number;
  learnedAt?: string;
  savedAt?: string;
  nextReviewAt?: string;
  word: VocabularyWord;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  learnedCount: number;
  savedCount: number;
  difficultCount: number;
  sessionCount: number;
  weeklyLearned: number;
  recentSessions: Array<{
    startedAt: string;
    wordsReviewed: number;
    score?: number;
    sessionType: string;
  }>;
}

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
    skill: string;
    difficulty: number;
    stageSuitability: string[];
    evaluationMode: "exact" | "auto" | "ai" | "rubric";
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
  correctAnswer?: string;
}

export interface FillBlankQuizQuestion extends BaseQuizQuestion {
  type: "fill_blank";
  sentence: string;
  options: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
}

export interface TranslationInputQuizQuestion extends BaseQuizQuestion {
  type: "translation_input";
  promptWord: string;
  correctAnswer?: string;
  acceptedAnswers?: string[];
}

export interface ReverseMultipleChoiceQuizQuestion extends BaseQuizQuestion {
  type: "reverse_multiple_choice";
  promptTranslation: string;
  options: string[];
  correctAnswer?: string;
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
  correctAnswer?: string;
  acceptedAnswers?: string[];
  options?: string[];
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
  correctAnswer?: string;
  acceptedAnswers?: string[];
}

export interface ReorderWordsQuizQuestion extends BaseQuizQuestion {
  type: "reorder_words";
  tokens: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
}

export interface MatchingQuizQuestion extends BaseQuizQuestion {
  type: "matching";
  pairs: Array<{ left: string; right: string }>;
  options: string[];
  correctAnswer?: string;
}

export interface ScriptRecognitionQuizQuestion extends BaseQuizQuestion {
  type: "script_recognition" | "reading_association";
  promptText: string;
  reading?: string;
  options: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
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
  correctAnswer?: string;
}

export interface ErrorCorrectionQuizQuestion extends BaseQuizQuestion {
  type: "error_correction";
  sentence: string;
  incorrectSegment?: string;
  correctAnswer?: string;
  acceptedAnswers?: string[];
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
  correctAnswer?: string;
  acceptedAnswers?: string[];
}

export type QuizQuestion =
  | MultipleChoiceQuizQuestion
  | FillBlankQuizQuestion
  | ReverseMultipleChoiceQuizQuestion
  | TranslationInputQuizQuestion
  | SentenceWritingQuizQuestion
  | ImageBasedQuizQuestion
  | GenericChoiceQuizQuestion
  | ReorderWordsQuizQuestion
  | MatchingQuizQuestion
  | ScriptRecognitionQuizQuestion
  | ReadingComprehensionQuizQuestion
  | ErrorCorrectionQuizQuestion
  | OpenWritingQuizQuestion
  | MediaExerciseQuestion;

export interface PracticeSubmissionResult {
  wordId: string;
  correct: boolean;
  evaluationStatus?: QuizEvaluationStatus;
  questionHash?: string;
  questionType?: QuizQuestion["type"];
  answer?: string;
  templateFamily?: string;
}

export interface SubmittedExerciseAnswer {
  questionHash: string;
  answer: string;
}

export interface DailyPractice {
  difficult: VocabularyWord[];
  learning: VocabularyWord[];
  new: VocabularyWord[];
}

export interface PaginatedWords {
  words: VocabularyWord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface CurriculumNode {
  id: string;
  _id?: string;
  nodeKey: string;
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
  skillFocus: string[];
  scriptFocus?: ScriptStage;
  exerciseMix: Array<{
    type: ExerciseType;
    weight: number;
    skill: string;
    difficulty: number;
    evaluationMode: string;
    mediaNeeds?: string;
    templateFamily?: string;
  }>;
  recommendedVocabulary: string[];
  grammarTargets: string[];
  interestTags: string[];
  estimatedMinutes: number;
  progress?: RoadmapProgress;
}

export interface RoadmapProgress {
  nodeId: string;
  status: "locked" | "available" | "in_progress" | "completed";
  progressPercent: number;
  attempts: number;
  bestScore?: number;
  lastScore?: number;
}

export interface LearningDashboard {
  learner: {
    level: CefrLevel;
    learnerStage: LearnerStage;
    scriptStage: ScriptStage;
    placementSource: PlacementSource;
    placementConfidence: number;
    interests: string[];
    learningGoal?: string;
    skillWeaknesses: Array<{ skill: keyof SubskillProfile; score: number }>;
  };
  continueLearning?: CurriculumNode;
  currentProgress?: {
    status: string;
    progressPercent: number;
    bestScore?: number;
    attempts: number;
  };
  dailyPath: CurriculumNode[];
  reviewDueCount: number;
  introducedCount: number;
  masteredCount: number;
  roadmapProgressPercent: number;
  promptContextPreview: string;
}

export interface LessonPayload {
  exerciseSessionId: string;
  node: CurriculumNode;
  focusWords: VocabularyWord[];
  phase: string;
  exercises: QuizQuestion[];
  scriptSupport: {
    language: string;
    scriptStage: ScriptStage;
    romajiAllowed: boolean;
    kanjiPolicy: string;
  };
}

export interface RoadmapPayload {
  currentRoadmapNodeId?: string;
  nodes: CurriculumNode[];
}

export interface LessonSubmissionSummary {
  score: number;
  correctCount: number;
  evaluatedCount: number;
  pendingReviewCount: number;
  total: number;
}

export interface PlacementSession {
  id: string;
  _id?: string;
  status: "active" | "finished" | "abandoned";
  language: string;
  nativeLanguage: string;
  targetItemCount: number;
  answeredCount: number;
}

export interface PlacementItem {
  sessionId: string;
  itemId: string;
  itemKey: string;
  type: "multiple_choice" | "fill_blank" | "reading_comprehension" | "short_production" | "script_recognition";
  skill: string;
  difficulty: number;
  cefrLevel: CefrLevel;
  prompt: string;
  passage?: string;
  choices: string[];
  progress: {
    answered: number;
    target: number;
  };
}

export interface PlacementResult {
  estimatedLevel: CefrLevel;
  confidence: number;
  subskillProfile: SubskillProfile;
  recommendedRoadmapNodeId?: string;
  learnerStage: LearnerStage;
  scriptStage: ScriptStage;
}

export interface MediaTask {
  id: string;
  sourceUrl: string;
  provider: "youtube" | "external";
  clipTitle: string;
  transcriptSegment: string;
  startSeconds: number;
  endSeconds: number;
  difficulty: number;
  level: CefrLevel;
  language: string;
  topic: string;
  roadmapNodeIds: string[];
  skillFocus: string[];
  exerciseTypes: ExerciseType[];
  questions?: Array<{
    question: string;
    passage: string;
    correctAnswer: string;
    options: string[];
  }>;
}
