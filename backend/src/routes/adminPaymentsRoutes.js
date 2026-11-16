const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");
const adminPaymentsController = require("../controllers/adminPaymentsController");

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));
router.get("/dashboard", adminPaymentsController.getPaymentsDashboard);

module.exports = router;
