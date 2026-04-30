import { Router } from "express";
import { query, body } from "express-validator";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import * as ctrl from "./word.controller";

const router = Router();

router.use(authenticate);

// Public word catalog
router.get(
  "/",
  [
    query("level").optional().isIn(["A1", "A2", "B1", "B2", "C1", "C2"]),
    query("topic").optional().trim(),
    query("language").optional().trim(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  ctrl.getWords
);

router.get("/recommended", ctrl.getRecommended);
router.get("/search", ctrl.searchWords);

// User word management
router.get("/me/list", ctrl.getMyWords);
router.post("/me/:wordId/save", ctrl.saveWord);
router.post("/me/:wordId/learned", ctrl.markLearned);
router.post("/me/:wordId/difficult", ctrl.markDifficult);
router.patch(
  "/me/:wordId/status",
  [body("status").isIn(["NEW", "LEARNING", "LEARNED", "DIFFICULT", "SAVED"])],
  validate,
  ctrl.updateWordStatus
);
router.delete("/me/:wordId", ctrl.removeWord);
router.get("/:id", ctrl.getWordById);

export default router;
