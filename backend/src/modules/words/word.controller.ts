import { Request, Response, NextFunction } from "express";
import * as service from "./word.service";
import { sendSuccess } from "../../utils/apiResponse";
import type { CefrLevel, WordStatus } from "../../models";

export async function getWords(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getWords(req.user!, {
      level: req.query.level as CefrLevel,
      topic: req.query.topic as string,
      language: req.query.language as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getWordById(req: Request, res: Response, next: NextFunction) {
  try {
    const word = await service.getWordByIdForUser(req.user!, req.params.id);
    sendSuccess(res, word);
  } catch (err) {
    next(err);
  }
}

export async function searchWords(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const words = await service.searchWords(req.user!, q, req.query.language as string);
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
}

export async function getRecommended(req: Request, res: Response, next: NextFunction) {
  try {
    const words = await service.getRecommendedWords(req.user!.id);
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
}

export async function getMyWords(req: Request, res: Response, next: NextFunction) {
  try {
    const words = await service.getUserWords(req.user!.id, req.query.status as WordStatus);
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
}

export async function saveWord(req: Request, res: Response, next: NextFunction) {
  try {
    const uw = await service.saveWord(req.user!.id, req.params.wordId);
    sendSuccess(res, uw);
  } catch (err) {
    next(err);
  }
}

export async function markLearned(req: Request, res: Response, next: NextFunction) {
  try {
    const uw = await service.markLearned(req.user!.id, req.params.wordId);
    sendSuccess(res, uw);
  } catch (err) {
    next(err);
  }
}

export async function markDifficult(req: Request, res: Response, next: NextFunction) {
  try {
    const uw = await service.markDifficult(req.user!.id, req.params.wordId);
    sendSuccess(res, uw);
  } catch (err) {
    next(err);
  }
}

export async function updateWordStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const uw = await service.updateWordStatus(
      req.user!.id,
      req.params.wordId,
      req.body.status
    );
    sendSuccess(res, uw);
  } catch (err) {
    next(err);
  }
}

export async function removeWord(req: Request, res: Response, next: NextFunction) {
  try {
    await service.removeWord(req.user!.id, req.params.wordId);
    sendSuccess(res, null, "Word removed");
  } catch (err) {
    next(err);
  }
}
