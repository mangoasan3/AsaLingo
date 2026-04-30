import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import * as ctrl from "./user.controller";

const router = Router();

router.use(authenticate);

router.get("/me", ctrl.getMe);
router.patch(
  "/me",
  [
    body("name").optional().trim().notEmpty(),
    body("currentLevel")
      .optional()
      .isIn(["A1", "A2", "B1", "B2", "C1", "C2"]),
    body("studyLanguage").optional().trim().notEmpty(),
    body("nativeLanguage").optional().trim().notEmpty(),
    body("learningGoal").optional().trim(),
    body("interests").optional().isArray(),
    body("preferredContentStyle")
      .optional()
      .isIn(["playful", "balanced", "practical", "academic", "challenge"]),
  ],
  validate,
  ctrl.updateMe
);
router.post(
  "/me/onboarding",
  [
    body("studyLanguage").trim().notEmpty().withMessage("Study language is required"),
    body("nativeLanguage").trim().notEmpty().withMessage("Native language is required"),
    body("currentLevel")
      .isIn(["A1", "A2", "B1", "B2", "C1", "C2"])
      .withMessage("Valid CEFR level is required"),
    body("interests").optional().isArray({ max: 12 }).withMessage("Interests must be an array"),
    body("interests.*").optional().isString().trim().notEmpty(),
    body("learningGoal").optional().isString().trim().isLength({ max: 160 }),
    body("preferredContentStyle")
      .optional()
      .isIn(["playful", "balanced", "practical", "academic", "challenge"]),
  ],
  validate,
  ctrl.completeOnboarding
);
router.get("/me/stats", ctrl.getStats);
router.delete("/me", ctrl.deleteAccount);

export default router;
