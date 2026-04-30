import { Request, Response, NextFunction } from "express";
import type { PracticeType } from "../../models";
import * as service from "./practice.service";
import { sendSuccess } from "../../utils/apiResponse";

export async function getDailyPractice(req: Request, res: Response, next: NextFunction) {
  try {
    const words = await service.getDailyWords(req.user!.id);
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
}

export async function submitPractice(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      sessionType,
      results,
      durationSecs,
      exerciseSessionId,
      roadmapNodeId,
      learnerStage,
      scriptStage,
      exerciseTypes,
      templateFamilies,
    } = req.body;
    const result = await service.submitPractice(
      req.user!.id,
      sessionType as PracticeType,
      results,
      durationSecs,
      { exerciseSessionId, roadmapNodeId, learnerStage, scriptStage, exerciseTypes, templateFamilies }
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
