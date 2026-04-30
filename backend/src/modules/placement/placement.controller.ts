import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import * as service from "./placement.service";

export async function startPlacement(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await service.startPlacement(req.user!.id, req.body);
    sendSuccess(res, session);
  } catch (err) {
    next(err);
  }
}

export async function getNextPlacementItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await service.getNextPlacementItem(req.user!.id, req.params.sessionId);
    sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
}

export async function submitPlacementAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.submitPlacementAnswer(
      req.user!.id,
      req.params.sessionId,
      req.body.itemId,
      req.body.answer
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function finishPlacement(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.finishPlacement(req.user!.id, req.params.sessionId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function completeManualPlacement(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.completeManualPlacement(req.user!.id, req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
