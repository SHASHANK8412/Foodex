const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");
const User = require("../models/User");

const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  res.status(StatusCodes.OK).json({ success: true, data: user });
});

module.exports = {
  register,
  login,
  googleLogin,
  me,
};
