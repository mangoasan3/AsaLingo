import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { buildLearningContext } from "./learningContext.service";
import * as service from "./learning.service";

export async function getContext(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await buildLearningContext(req.user!.id);
    sendSuccess(res, context);
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await service.getDashboard(req.user!.id);
    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
}

export async function getRoadmap(req: Request, res: Response, next: NextFunction) {
  try {
    const roadmap = await service.getRoadmap(req.user!.id);
    sendSuccess(res, roadmap);
  } catch (err) {
    next(err);
  }
}

export async function getContinueLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const lesson = await service.getContinueLesson(req.user!.id);
    sendSuccess(res, lesson);
  } catch (err) {
    next(err);
  }
}

export async function getPractice(req: Request, res: Response, next: NextFunction) {
  try {
    const mode = req.query.mode === "review" || req.query.mode === "challenge"
      ? req.query.mode
      : "lesson";
    const practice = await service.getStageAwarePractice(req.user!.id, mode);
    sendSuccess(res, practice);
  } catch (err) {
    next(err);
  }
}

export async function submitLearningResults(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.submitLearningResults(req.user!.id, req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getMediaTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const mediaTasks = await service.getMediaTasks(req.user!.id);
    sendSuccess(res, mediaTasks);
  } catch (err) {
    next(err);
  }
}

export async function setCurrentRoadmapNode(req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await service.setCurrentRoadmapNode(req.user!.id, req.params.nodeId);
    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
}
