const express = require("express");
const authController = require("../controllers/authController");
const validate = require("../middlewares/validateMiddleware");
const { protect } = require("../middlewares/authMiddleware");
const { registerValidator, loginValidator, googleLoginValidator } = require("../validators/authValidator");

const router = express.Router();

router.post("/register", registerValidator, validate, authController.register);
router.post("/login", loginValidator, validate, authController.login);
router.post("/google", googleLoginValidator, validate, authController.googleLogin);
router.get("/me", protect, authController.me);

module.exports = router;
