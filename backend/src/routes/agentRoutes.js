const express = require("express");
const { body } = require("express-validator");
const { rateLimit } = require("express-rate-limit");
const agentController = require("../controllers/agentController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateMiddleware");

const router = express.Router();

router.use(protect);

// Each plan costs several LLM calls: 12 per 10 minutes per customer.
const planLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.userId),
  message: { success: false, message: "You've asked the assistant a lot recently. Try again in a few minutes." },
  skip: () => process.env.NODE_ENV === "test",
});

router.post(
  "/plan",
  planLimiter,
  body("request").isString().trim().isLength({ min: 3, max: 500 }).withMessage("Describe your order in 3 to 500 characters"),
  validate,
  agentController.plan
);
router.get("/proposals/:proposalId", agentController.getProposal);
router.post(
  "/proposals/:proposalId/confirm",
  body("deliveryAddress.line1").notEmpty().withMessage("Delivery address line1 is required"),
  body("deliveryAddress.city").notEmpty().withMessage("Delivery city is required"),
  body("deliveryAddress.state").notEmpty().withMessage("Delivery state is required"),
  body("deliveryAddress.postalCode").notEmpty().withMessage("Delivery postal code is required"),
  validate,
  agentController.confirm
);

module.exports = router;
