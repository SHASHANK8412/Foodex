const { body } = require("express-validator");

const restaurantValidator = [
  body("name").trim().notEmpty().withMessage("Restaurant name is required"),
  body("address.line1").notEmpty().withMessage("Address line is required"),
  body("address.city").notEmpty().withMessage("City is required"),
  body("address.state").notEmpty().withMessage("State is required"),
  body("address.postalCode").notEmpty().withMessage("Postal code is required"),
];

const menuItemValidator = [
  body("name").trim().notEmpty().withMessage("Item name is required"),
  body("price").isFloat({ gt: 0 }).withMessage("Price must be greater than 0"),
  body("category").optional().isString(),
];

module.exports = {
  restaurantValidator,
  menuItemValidator,
};
