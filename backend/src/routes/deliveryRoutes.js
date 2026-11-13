const express = require("express");
const deliveryController = require("../controllers/deliveryController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const validate = require("../middlewares/validateMiddleware");
const ROLES = require("../constants/roles");
const { deliveryPartnerValidator } = require("../validators/deliveryValidator");

const router = express.Router();

// Delivery partner-specific routes
// ROLES.DELIVERY_PARTNER does not exist, so this route used to reject every rider.
router.get("/me", protect, authorize(ROLES.DELIVERY), deliveryController.getMyProfile);
router.put("/availability", protect, authorize(ROLES.DELIVERY), deliveryController.updateAvailability);

// Admin routes for managing delivery partners
router.use(protect, authorize(ROLES.ADMIN));

router.get("/partners", deliveryController.listPartners);
router.post("/partners", ...deliveryPartnerValidator, validate, deliveryController.createPartner);

module.exports = router;
