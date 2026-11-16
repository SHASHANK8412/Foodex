const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const Leaderboard = require("../models/Leaderboard");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const getMyLoyaltyStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId)
    .select("loyalty")
    .populate("loyalty.badges");

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: user.loyalty,
  });
});

const getLeaderboard = asyncHandler(async (req, res) => {
  const { type = "WEEKLY_SPEND", period, city } = req.query;

  // In a real app, you'd calculate the current period string (e.g., '2026-W15')
  const currentPeriod = period || "2026-W15"; // Placeholder

  const query = { type, period: currentPeriod };
  if (city) {
    query.city = city;
  }

  const leaderboard = await Leaderboard.findOne(query).sort({ "entries.rank": 1 });

  if (!leaderboard) {
    // You might want to return an empty leaderboard instead of a 404
    return res.status(StatusCodes.OK).json({
      success: true,
      data: { type, period: currentPeriod, city, entries: [] },
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: leaderboard,
  });
});

module.exports = {
  getMyLoyaltyStats,
  getLeaderboard,
};
