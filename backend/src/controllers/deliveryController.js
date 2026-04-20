const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const deliveryService = require("../services/deliveryService");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

const listPartners = asyncHandler(async (_req, res) => {
  const partners = await deliveryService.listDeliveryPartners();
  res.status(StatusCodes.OK).json({ success: true, data: partners });
});

const createPartner = asyncHandler(async (req, res) => {
  const partner = await deliveryService.createDeliveryPartner(req.body);

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: {
      id: partner._id,
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      role: partner.role,
    },
  });
});

const updateAvailability = asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;
  const deliveryPartnerId = req.user.userId;

  const partner = await User.findById(deliveryPartnerId);
  if (!partner || partner.role !== "delivery") {
    throw new ApiError(StatusCodes.NOT_FOUND, "Delivery partner not found");
  }

  if (!partner.deliveryPartnerProfile) {
    partner.deliveryPartnerProfile = {};
  }
  partner.deliveryPartnerProfile.isAvailable = isAvailable;
  await partner.save();

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      isAvailable: partner.deliveryPartnerProfile.isAvailable,
    },
  });
});

module.exports = {
  listPartners,
  createPartner,
  updateAvailability,
};
