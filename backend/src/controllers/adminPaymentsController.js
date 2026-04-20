const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const paymentAdminService = require("../services/paymentAdminService");

const getPaymentsDashboard = asyncHandler(async (req, res) => {
  const data = await paymentAdminService.getPaymentDashboard({
    from: req.query.from,
    to: req.query.to,
    userId: req.query.userId,
    restaurantId: req.query.restaurantId,
    status: req.query.status,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  getPaymentsDashboard,
};
