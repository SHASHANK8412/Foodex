const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/recommendations", protect, analyticsController.getRecommendations);
router.get("/demand/:restaurantId", analyticsController.getDemandPrediction);
router.get("/delivery-estimate", analyticsController.getDeliveryEstimate);

module.exports = router;
