import type { CefrLevel } from "../models/User";
import type { SkillFocus } from "../models/CurriculumNode";

export interface CuratedMediaQuestion {
  question: string;
  passage: string;
  correctAnswer: string;
  options: string[];
}

export interface CuratedMediaTask {
  _id: string;
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
  skillFocus: SkillFocus[];
  exerciseTypes: string[];
  isActive: boolean;
  questions: CuratedMediaQuestion[];
}

const YOUTUBE_SOURCE_URL_PATTERN = /(?:youtube\.com|youtu\.be)/i;

export const CURATED_MEDIA_TASKS: CuratedMediaTask[] = [];

export function getCuratedMediaTasksForLanguage(language: string): CuratedMediaTask[] {
  return CURATED_MEDIA_TASKS.filter(
    (task) =>
      task.language === language &&
      task.provider !== "youtube" &&
      !YOUTUBE_SOURCE_URL_PATTERN.test(task.sourceUrl)
  );
}
