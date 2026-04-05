const express = require("express");
const deliveryController = require("../controllers/deliveryController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const validate = require("../middlewares/validateMiddleware");
const ROLES = require("../constants/roles");
const { deliveryPartnerValidator } = require("../validators/deliveryValidator");

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get("/partners", deliveryController.listPartners);
router.post("/partners", deliveryPartnerValidator, validate, deliveryController.createPartner);

module.exports = router;
