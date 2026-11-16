const { StatusCodes } = require("http-status-codes");
const ApiError = require("../utils/ApiError");

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required. Please log in."));
    }

    const userRoles = req.user.roles || [req.user.role];
    
    const hasPermission = userRoles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      return next(new ApiError(StatusCodes.FORBIDDEN, "You do not have sufficient permissions to perform this action."));
    }

    next();
  };
};

module.exports = {
  authorize,
};
