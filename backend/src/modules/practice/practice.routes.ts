import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import * as ctrl from "./practice.controller";

const router = Router();
router.use(authenticate);

router.get("/daily", ctrl.getDailyPractice);
router.post(
  "/submit",
  [
    body("sessionType").isIn([
      "MULTIPLE_CHOICE",
      "FILL_BLANK",
      "MATCH",
      "SENTENCE_CONTEXT",
      "DAILY_REVIEW",
      "MIXED",
      "GUIDED_LESSON",
      "ROADMAP_REVIEW",
      "PLACEMENT",
      "MEDIA",
    ]),
    body("exerciseSessionId").optional().isString().trim().notEmpty(),
    body("results").isArray(),
    body("results.*.answer").isString().trim().notEmpty(),
    body("results.*.questionHash").optional().isString().trim().notEmpty(),
    body("results.*.wordId").optional().isString().trim().notEmpty(),
    body("results.*.questionType").optional().isString().trim().notEmpty(),
    body("results.*.templateFamily").optional().isString().trim().notEmpty(),
    body("durationSecs").optional().isInt({ min: 0 }),
    body("roadmapNodeId").optional().isString(),
    body("learnerStage").optional().isString(),
    body("scriptStage").optional().isString(),
    body("exerciseTypes").optional().isArray(),
    body("templateFamilies").optional().isArray(),
  ],
  validate,
  ctrl.submitPractice
);

export default router;
