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

module.exports = {
  protect,
};
