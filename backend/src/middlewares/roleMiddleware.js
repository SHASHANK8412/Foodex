const { StatusCodes } = require("http-status-codes");
const ApiError = require("../utils/ApiError");

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized"));
  }

  if (!roles.includes(req.user.role)) {
    return next(new ApiError(StatusCodes.FORBIDDEN, "Insufficient permissions"));
  }

  next();
};

module.exports = {
  authorize,
};
