const express = require("express");
const orderController = require("../controllers/orderController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const validate = require("../middlewares/validateMiddleware");
const ROLES = require("../constants/roles");
const {
  createOrderValidator,
  verifyPaymentValidator,
  updateStatusValidator,
  assignDeliveryValidator,
} = require("../validators/orderValidator");

const router = express.Router();

router.post("/razorpay/webhook", orderController.razorpayWebhook);

router.use(protect);

router.get("/", orderController.listOrders);
router.get("/:orderId/payment-status", orderController.getPaymentDiagnostics);
router.get("/:orderId", orderController.getOrder);
router.post("/", ...createOrderValidator, validate, orderController.createOrder);
router.post("/verify-payment", ...verifyPaymentValidator, validate, orderController.verifyPayment);
router.patch(
  "/:orderId/status",
  authorize(ROLES.ADMIN, ROLES.DELIVERY),
  ...updateStatusValidator,
  validate,
  orderController.updateStatus
);
router.patch(
  "/:orderId/assign-delivery",
  authorize(ROLES.ADMIN),
  ...assignDeliveryValidator,
  validate,
  orderController.assignDeliveryPartner
);

module.exports = router;
