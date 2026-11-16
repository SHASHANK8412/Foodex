const { body } = require("express-validator");

const deliveryPartnerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password should be at least 6 characters"),
  body("phone").optional().isString(),
];

module.exports = {
  deliveryPartnerValidator,
};
