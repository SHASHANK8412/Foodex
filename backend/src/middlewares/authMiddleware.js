const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

const protect = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authorization token is required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, "User not authorized"));
    }

    req.user = {
      userId: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Invalid or expired token"));
  }
};

// For endpoints that also serve signed-out visitors: a valid token attaches the
// user, a missing or invalid one leaves req.user unset.
const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], env.jwtSecret);
    req.user = { userId: decoded.userId, role: decoded.role };
  } catch (_error) {
    // Treated as anonymous.
  }
  return next();
};

module.exports = {
  protect,
  optionalAuth,
};
