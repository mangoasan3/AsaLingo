import { Request, Response, NextFunction } from "express";
import * as service from "./ai.service";
import { sendSuccess } from "../../utils/apiResponse";
import type { CefrLevel } from "../../models";
import { AppError } from "../../middleware/errorHandler";

export async function explainWord(req: Request, res: Response, next: NextFunction) {
  try {
    const level = (req.body.level || req.user!.currentLevel) as CefrLevel;
    const result = await service.explainWord(
      req.body.wordId,
      level,
      req.user!.studyLanguage || "en",
      req.user!.nativeLanguage || "ru"
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function exampleSentences(req: Request, res: Response, next: NextFunction) {
  try {
    const level = (req.body.level || req.user!.currentLevel) as CefrLevel;
    const result = await service.generateExamples(
      req.body.wordId,
      level,
      req.user!.studyLanguage || "en",
      req.user!.nativeLanguage || "ru"
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function generateQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const questions = await service.generateQuiz(
      req.user!.id,
      req.user!.currentLevel,
      req.user!.studyLanguage || "en",
      req.user!.nativeLanguage || "ru"
    );
    sendSuccess(res, questions.map(service.toPublicQuizQuestion));
  } catch (err) {
    next(err);
  }
}

export async function generateDiscoverQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const questions = await service.generateDiscoverQuiz(
      req.user!.id,
      req.user!.currentLevel,
      req.user!.studyLanguage || "en",
      req.user!.nativeLanguage || "ru"
    );
    sendSuccess(res, questions.map(service.toPublicQuizQuestion));
  } catch (err) {
    next(err);
  }
}

export async function evaluateQuizAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const level = (req.body.level || req.user!.currentLevel) as CefrLevel;
    const result = await service.evaluateQuizAnswer({
      level,
      studyLanguage: req.user!.studyLanguage || "en",
      nativeLanguage: req.user!.nativeLanguage || "ru",
      question: req.body.question,
      answer: req.body.answer,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function similarWords(req: Request, res: Response, next: NextFunction) {
  try {
    const words = await service.getSimilarWords(
      req.body.wordId,
      req.user!.currentLevel,
      req.user!.studyLanguage || "en",
      req.user!.nativeLanguage || "ru"
    );
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
}

export async function generateWords(req: Request, res: Response, next: NextFunction) {
  try {
    const level = (req.body.level || req.user!.currentLevel) as CefrLevel;
    const count = Math.min(Number(req.body.count) || 20, 50);
    const saved = await service.generateAndSaveWords({
      level,
      targetLanguage: req.user!.studyLanguage || "en",
      nativeLanguage: req.user!.nativeLanguage || "ru",
      count,
      topic: req.body.topic,
      lessonStep: req.body.lessonStep,
      progressionStep: req.body.progressionStep,
    });
    sendSuccess(res, { saved: saved.length, level, words: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      next(new AppError("AI generation is temporarily unavailable because all AI API keys are exhausted", 503));
      return;
    }
    next(err);
  }
}
