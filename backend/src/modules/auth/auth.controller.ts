import { Request, Response, NextFunction } from "express";
import { IUser } from "../../models";
import * as service from "./auth.service";
import { sendSuccess } from "../../utils/apiResponse";
import { env } from "../../config/env";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    const { tokens, user } = await service.registerUser(name, email, password);
    setRefreshCookie(res, tokens.refreshToken);
    sendSuccess(
      res,
      {
        accessToken: tokens.accessToken,
        user: sanitizeUser(user),
      },
      "Registration successful",
      201
    );
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const { tokens, user } = await service.loginUser(email, password);
    setRefreshCookie(res, tokens.refreshToken);
    sendSuccess(res, {
      accessToken: tokens.accessToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ success: false, message: "Refresh token required" });
      return;
    }
    const tokens = await service.refreshTokens(refreshToken);
    setRefreshCookie(res, tokens.refreshToken);
    sendSuccess(res, { accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const user = req.user as IUser;
    await service.logoutUser(user._id, refreshToken);
    res.clearCookie("refreshToken");
    sendSuccess(res, null, "Logged out");
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response) {
  sendSuccess(res, sanitizeUser(req.user as IUser));
}

export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as IUser;
    const tokens = await service.issueTokens(user._id, user.email);
    setRefreshCookie(res, tokens.refreshToken);
    // Redirect to frontend with access token
    res.redirect(
      `${env.FRONTEND_URL}/auth/google/callback?token=${tokens.accessToken}&onboarding=${!user.onboardingDone}`
    );
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    await service.requestPasswordReset(email);
    // Always return success — prevents email enumeration
    sendSuccess(res, null, "If that email exists, a reset link has been sent.");
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    await service.resetPassword(token, password);
    sendSuccess(res, null, "Password has been reset successfully.");
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function sanitizeUser(user: IUser) {
  const obj = user.toJSON ? user.toJSON() : { ...user };
  delete (obj as Record<string, unknown>).passwordHash;
  return obj;
}
