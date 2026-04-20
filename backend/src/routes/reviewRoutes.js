const express = require("express");
const reviewController = require("../controllers/reviewController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(protect);

router.get("/me", authorize(ROLES.USER), reviewController.listMyReviews);
router.post("/", authorize(ROLES.USER), reviewController.createReview);
router.get("/owner", authorize(ROLES.OWNER, ROLES.ADMIN), reviewController.listOwnerReviews);
router.patch("/:reviewId/respond", authorize(ROLES.OWNER, ROLES.ADMIN), reviewController.respondToReview);

module.exports = router;
