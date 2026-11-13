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

const getFrequentlyBoughtTogether = asyncHandler(async (req, res) => {
  const menuItemIds = String(req.query.menuItemIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  const data = await analyticsService.getFrequentlyBoughtTogether({
    restaurantId: req.query.restaurantId,
    menuItemIds,
    limit: Math.min(6, Math.max(1, Number(req.query.limit) || 3)),
  });
  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  getFrequentlyBoughtTogether,
  getRecommendations,
  getDemandPrediction,
  getDeliveryEstimate,
};
