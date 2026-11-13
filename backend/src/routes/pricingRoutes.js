const express = require("express");
const pricingController = require("../controllers/pricingController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateMiddleware");
const { quoteValidator } = require("../validators/orderValidator");

const router = express.Router();

// Signed-out visitors can price a cart too; coupons that need an account say so.
router.post("/quote", optionalAuth, ...quoteValidator, validate, pricingController.getQuote);
router.get("/offers", pricingController.listOffers);

module.exports = router;
