import { Request, Response, NextFunction } from "express";
import * as service from "./user.service";
import { sendSuccess } from "../../utils/apiResponse";

function sanitize(user: Record<string, unknown>) {
  const safe = { ...user };
  delete safe.passwordHash;
  return safe;
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.getUserById(req.user!.id);
    sendSuccess(res, sanitize(user as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.updateUser(req.user!.id, req.body);
    sendSuccess(res, sanitize(user as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.completeOnboarding(req.user!.id, req.body);
    sendSuccess(res, sanitize(user as unknown as Record<string, unknown>));
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await service.getUserStats(req.user!.id);
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteUser(req.user!.id);
    res.clearCookie("refreshToken");
    sendSuccess(res, null, "Account deleted");
  } catch (err) {
    next(err);
  }
}
