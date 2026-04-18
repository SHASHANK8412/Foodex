const { StatusCodes } = require("http-status-codes");
const ApiError = require("../utils/ApiError");
const ROLES = require("../constants/roles");

const ownerScope = (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized"));
  }

  if (req.user.role === ROLES.ADMIN) {
    req.ownerScope = null;
    return next();
  }

  if (req.user.role !== ROLES.OWNER) {
    return next(new ApiError(StatusCodes.FORBIDDEN, "Owner access required"));
  }

  req.ownerScope = String(req.user.userId);
  return next();
};

module.exports = {
  ownerScope,
};
