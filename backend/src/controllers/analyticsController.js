const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const analyticsService = require("../services/analyticsService");

const getRecommendations = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRecommendations(req.user.userId);
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getDemandPrediction = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDemandPrediction(req.params.restaurantId);
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getDeliveryEstimate = asyncHandler(async (req, res) => {
  const { distanceKm, itemCount, hourOfDay } = req.query;
  const data = analyticsService.estimateDeliveryTime({
    distanceKm,
    itemCount,
    hourOfDay,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  getRecommendations,
  getDemandPrediction,
  getDeliveryEstimate,
};
