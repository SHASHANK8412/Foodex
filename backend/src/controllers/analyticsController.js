const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const mongoose = require("mongoose");
const analyticsService = require("../services/analyticsService");
const Restaurant = require("../models/Restaurant");

const getRecommendations = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRecommendations(req.user.userId);
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getDemandPrediction = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDemandPrediction(req.params.restaurantId);
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getDeliveryEstimate = asyncHandler(async (req, res) => {
  const { distanceKm, itemCount, hourOfDay, restaurantId } = req.query;

  // With a restaurant, include its live kitchen wait (the same estimate the
  // ordering agent uses); without one, the generic model estimate.
  if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    const restaurant = await Restaurant.findById(restaurantId).select("estimatedWaitMinutes avgPrepMinutes").lean();
    if (restaurant) {
      const eta = analyticsService.estimateOrderEta({ restaurant, itemCount, distanceKm, hourOfDay });
      return res.status(StatusCodes.OK).json({
        success: true,
        data: { source: eta.source, estimatedMinutes: eta.minutes, breakdown: eta },
      });
    }
  }

  const data = analyticsService.estimateDeliveryTime({
    distanceKm,
    itemCount,
    hourOfDay,
  });

  return res.status(StatusCodes.OK).json({ success: true, data });
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
