const { body } = require("express-validator");
const ROLES = require("../constants/roles");

const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("phone").optional().isString(),
  body("role")
    .optional()
    .isIn([ROLES.USER, ROLES.DELIVERY, ROLES.RESTAURANT])
    .withMessage("Role must be user, delivery, or restaurant"),
];

const loginValidator = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const googleLoginValidator = [
  body("idToken").notEmpty().withMessage("Google idToken is required"),
];

module.exports = {
  registerValidator,
  loginValidator,
  googleLoginValidator,
};
