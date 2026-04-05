const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const ApiError = require("../utils/ApiError");

const listDeliveryPartners = async () => {
  return User.find({ role: ROLES.DELIVERY, isActive: true }).select("name email phone");
};

const createDeliveryPartner = async (payload) => {
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, "Email already in use");
  }

  return User.create({
    ...payload,
    role: ROLES.DELIVERY,
  });
};

module.exports = {
  listDeliveryPartners,
  createDeliveryPartner,
};
