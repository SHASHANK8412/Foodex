const express = require("express");
const { getMyLoyaltyStats, getLeaderboard } = require("../controllers/loyaltyController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/me", protect, getMyLoyaltyStats);
router.get("/leaderboard", getLeaderboard);

module.exports = router;
