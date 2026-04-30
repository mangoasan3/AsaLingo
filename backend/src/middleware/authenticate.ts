import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { IUser } from "../models";
import { AppError } from "./errorHandler";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate("jwt", { session: false }, (err: Error, user: IUser | false) => {
    if (err) return next(err);
    if (!user) return next(new AppError("Unauthorized", 401));
    req.user = user;
    next();
  })(req, res, next);
}

// Extend Express Request type to include Mongoose user
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}
