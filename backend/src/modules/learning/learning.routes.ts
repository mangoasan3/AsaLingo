import { Router } from "express";
import { body, param, query } from "express-validator";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import * as ctrl from "./learning.controller";

const router = Router();

router.use(authenticate);

router.get("/context", ctrl.getContext);
router.get("/dashboard", ctrl.getDashboard);
router.get("/roadmap", ctrl.getRoadmap);
router.get("/continue", ctrl.getContinueLesson);
router.get(
  "/practice",
  [query("mode").optional().isIn(["lesson", "review", "challenge"])],
  validate,
  ctrl.getPractice
);
router.get("/media-tasks", ctrl.getMediaTasks);
router.post(
  "/submit",
  [
    body("sessionType")
      .optional()
      .isIn(["GUIDED_LESSON", "ROADMAP_REVIEW", "MIXED", "MEDIA"]),
    body("exerciseSessionId").optional().isString().trim().notEmpty(),
    body("roadmapNodeId").optional().isString().trim().notEmpty(),
    body("results").isArray(),
    body("results.*.questionHash").isString().trim().notEmpty(),
    body("results.*.answer").isString().trim().notEmpty(),
    body("results.*.wordId").optional().isString().trim().notEmpty(),
    body("results.*.questionType").optional().isString().trim().notEmpty(),
    body("results.*.templateFamily").optional().isString(),
    body("durationSecs").optional().isInt({ min: 0 }),
  ],
  validate,
  ctrl.submitLearningResults
);
router.post(
  "/roadmap/:nodeId/start",
  [param("nodeId").isString().trim().notEmpty()],
  validate,
  ctrl.setCurrentRoadmapNode
);

export default router;
