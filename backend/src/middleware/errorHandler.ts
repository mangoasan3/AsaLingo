import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ success: false, message: err.message, errors: err.errors });
    return;
  }

  // MongoDB duplicate key error
  const mongoErr = err as unknown as Record<string, unknown>;
  if (mongoErr.code === 11000) {
    res.status(409).json({ success: false, message: "Resource already exists" });
    return;
  }

  logger.error(err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
