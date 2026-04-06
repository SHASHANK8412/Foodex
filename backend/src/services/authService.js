const { StatusCodes } = require("http-status-codes");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const ROLES = require("../constants/roles");
const env = require("../config/env");

const googleClient = new OAuth2Client();

const registerUser = async (payload) => {
  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, "Email already registered");
  }

  const user = await User.create({
    ...payload,
    role: ROLES.USER,
  });
  const token = user.generateAuthToken();

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
  }

  if (!user.password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "This account uses Google login");
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
  }

  const token = user.generateAuthToken();

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  };
};

const loginWithGoogle = async ({ idToken }) => {
  if (!env.googleClientId) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Google login is not configured");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid Google token payload");
  }

  let user = await User.findOne({ email: payload.email.toLowerCase() });

  if (!user) {
    user = await User.create({
      name: payload.name || payload.email.split("@")[0],
      email: payload.email.toLowerCase(),
      googleId: payload.sub,
      authProvider: "google",
      role: ROLES.USER,
    });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    user.authProvider = "google";
    await user.save();
  }

  const token = user.generateAuthToken();

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    },
  };
};

module.exports = {
  registerUser,
  loginUser,
  loginWithGoogle,
};
