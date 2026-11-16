const express = require("express");
const { body } = require("express-validator");
const aiController = require("../controllers/aiController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateMiddleware");

const router = express.Router();

router.post(
  "/semantic-search",
  body("query").trim().notEmpty().withMessage("query is required"),
  validate,
  aiController.semanticSearch
);

router.use(protect);

router.post(
  "/compare-item",
  body("item").optional().trim(),
  body("dish").optional().trim(),
  body().custom((value) => {
    if (!value.item && !value.dish) {
      throw new Error("item or dish is required");
    }
    return true;
  }),
  validate,
  aiController.compareItem
);

router.post(
  "/chat",
  body("message").trim().notEmpty().withMessage("message is required"),
  validate,
  aiController.chat
);

router.post(
  "/chat/stream",
  body("message").trim().notEmpty().withMessage("message is required"),
  validate,
  aiController.chatStream
);

router.get("/recommendations", aiController.recommendations);
router.get("/quick-reorder", aiController.quickReorder);

router.post(
  "/generate",
  body("prompt").trim().notEmpty().withMessage("prompt is required"),
  validate,
  aiController.generateAiContent
);

module.exports = router;
