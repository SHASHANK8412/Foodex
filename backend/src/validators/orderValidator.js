const { body } = require("express-validator");
const { ORDER_STATUS } = require("../constants/order");

const createOrderValidator = [
  body("restaurantId").isMongoId().withMessage("Valid restaurantId is required"),
  body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
  body("items.*.menuItemId").isMongoId().withMessage("Valid menuItemId is required"),
  body("items.*.quantity").isInt({ gt: 0 }).withMessage("Quantity must be greater than 0"),
  body("deliveryAddress.line1").notEmpty().withMessage("Delivery address line1 is required"),
  body("deliveryAddress.city").notEmpty().withMessage("Delivery city is required"),
  body("deliveryAddress.state").notEmpty().withMessage("Delivery state is required"),
  body("deliveryAddress.postalCode").notEmpty().withMessage("Delivery postal code is required"),
];

const verifyPaymentValidator = [
  body("orderId").isMongoId().withMessage("Valid orderId is required"),
  body("razorpayOrderId").notEmpty().withMessage("razorpayOrderId is required"),
  body("razorpayPaymentId").notEmpty().withMessage("razorpayPaymentId is required"),
  body("razorpaySignature").notEmpty().withMessage("razorpaySignature is required"),
];

const updateStatusValidator = [
  body("status")
    .isIn(Object.values(ORDER_STATUS))
    .withMessage(`Status must be one of: ${Object.values(ORDER_STATUS).join(", ")}`),
  body("note").optional().isString(),
  body("location.lat").optional().isFloat(),
  body("location.lng").optional().isFloat(),
];

const assignDeliveryValidator = [
  body("deliveryPartnerId").isMongoId().withMessage("Valid deliveryPartnerId is required"),
];

module.exports = {
  createOrderValidator,
  verifyPaymentValidator,
  updateStatusValidator,
  assignDeliveryValidator,
};
