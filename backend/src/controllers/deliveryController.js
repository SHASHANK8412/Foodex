const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const deliveryService = require("../services/deliveryService");

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

module.exports = {
  listPartners,
  createPartner,
};
