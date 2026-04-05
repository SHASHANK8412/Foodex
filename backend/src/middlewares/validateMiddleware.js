const { validationResult } = require("express-validator");
const { StatusCodes } = require("http-status-codes");

const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next({
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Validation failed",
      details: errors.array(),
      isOperational: true,
    });
  }

  next();
};

module.exports = validate;
