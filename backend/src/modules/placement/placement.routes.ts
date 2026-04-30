import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import * as ctrl from "./placement.controller";

const router = Router();

router.use(authenticate);

router.post(
  "/start",
  [
    body("studyLanguage").isString().trim().notEmpty(),
    body("nativeLanguage").isString().trim().notEmpty(),
    body("interests").optional().isArray({ max: 16 }),
    body("learningGoal").optional().isString().trim().isLength({ max: 220 }),
    body("preferredContentStyle")
      .optional()
      .isIn(["playful", "balanced", "practical", "academic", "challenge"]),
  ],
  validate,
  ctrl.startPlacement
);

router.get(
  "/:sessionId/next",
  [param("sessionId").isString().trim().notEmpty()],
  validate,
  ctrl.getNextPlacementItem
);

router.post(
  "/:sessionId/submit",
  [
    param("sessionId").isString().trim().notEmpty(),
    body("itemId").isString().trim().notEmpty(),
    body("answer").isString().trim().notEmpty(),
  ],
  validate,
  ctrl.submitPlacementAnswer
);

router.post(
  "/:sessionId/finish",
  [param("sessionId").isString().trim().notEmpty()],
  validate,
  ctrl.finishPlacement
);

router.post(
  "/manual",
  [
    body("studyLanguage").isString().trim().notEmpty(),
    body("nativeLanguage").isString().trim().notEmpty(),
    body("currentLevel").isIn(["A1", "A2", "B1", "B2", "C1", "C2"]),
    body("interests").optional().isArray({ max: 16 }),
    body("learningGoal").optional().isString().trim().isLength({ max: 220 }),
    body("preferredContentStyle")
      .optional()
      .isIn(["playful", "balanced", "practical", "academic", "challenge"]),
  ],
  validate,
  ctrl.completeManualPlacement
);

export default router;
