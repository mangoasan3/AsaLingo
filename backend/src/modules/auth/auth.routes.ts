import { Router } from "express";
import passport from "passport";
import { body } from "express-validator";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter,
} from "../../middleware/rateLimiter";
import * as ctrl from "./auth.controller";

const router = Router();

router.post(
  "/register",
  registerRateLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  validate,
  ctrl.register
);

router.post(
  "/login",
  loginRateLimiter,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  validate,
  ctrl.login
);

router.post("/refresh", ctrl.refresh);
router.post("/logout", authenticate, ctrl.logout);
router.get("/me", authenticate, ctrl.me);

// Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  ctrl.googleCallback
);

router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  [body("email").isEmail().normalizeEmail()],
  validate,
  ctrl.forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordRateLimiter,
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  validate,
  ctrl.resetPassword
);

export default router;
