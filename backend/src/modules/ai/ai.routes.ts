import { Router } from "express";
import { body, param } from "express-validator";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import * as ctrl from "./ai.controller";

const router = Router();
router.use(authenticate);

router.post(
  "/explain-word",
  [body("wordId").notEmpty(), body("level").optional().isIn(["A1","A2","B1","B2","C1","C2"])],
  validate,
  ctrl.explainWord
);

router.post(
  "/example-sentences",
  [body("wordId").notEmpty(), body("level").optional().isIn(["A1","A2","B1","B2","C1","C2"])],
  validate,
  ctrl.exampleSentences
);

router.post("/generate-quiz", ctrl.generateQuiz);
router.post("/generate-discover-quiz", ctrl.generateDiscoverQuiz);
router.post(
  "/evaluate-quiz-answer",
  [
    body("question").isObject(),
    body("question.wordId").notEmpty(),
    body("question.type").isIn([
      "multiple_choice",
      "fill_blank",
      "translation_input",
      "reverse_multiple_choice",
      "sentence_writing",
      "image_based",
      "word_to_picture",
      "picture_to_word",
      "tap_translation",
      "tap_heard_phrase",
      "reorder_words",
      "choose_missing_word",
      "matching",
      "script_recognition",
      "reading_association",
      "fill_in_context",
      "paraphrase_choice",
      "translation_variants",
      "short_dictation",
      "transcript_gap_fill",
      "reading_comprehension",
      "error_correction",
      "open_translation",
      "short_paragraph_response",
      "summary",
      "argument_response",
      "essay_writing",
      "media_transcript",
      "media_comprehension",
    ]),
    body("answer").notEmpty(),
  ],
  validate,
  ctrl.evaluateQuizAnswer
);
router.post(
  "/generate-words",
  [body("level").optional().isIn(["A1","A2","B1","B2","C1","C2"]), body("count").optional().isInt({ min: 1, max: 50 })],
  validate,
  ctrl.generateWords
);

router.post(
  "/similar-words",
  [body("wordId").notEmpty()],
  validate,
  ctrl.similarWords
);

export default router;
