const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const authController = require("../controllers/authController");
const validate = require("../middlewares/validateMiddleware");
const { protect } = require("../middlewares/authMiddleware");
const { registerValidator, loginValidator, googleLoginValidator } = require("../validators/authValidator");

const router = express.Router();

// Slows down password guessing: 10 attempts per 15 minutes per IP and email.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || "").toLowerCase()}`,
  message: { success: false, message: "Too many attempts. Try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "test",
});

router.post("/register", credentialLimiter, ...registerValidator, validate, authController.register);
router.post("/login", credentialLimiter, ...loginValidator, validate, authController.login);
router.post("/google", ...googleLoginValidator, validate, authController.googleLogin);
router.get("/me", protect, authController.me);

module.exports = router;
