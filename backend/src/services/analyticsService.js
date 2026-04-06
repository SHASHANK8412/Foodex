const fs = require("fs");
const path = require("path");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const env = require("../config/env");

const outputDir = env.analyticsOutputDir;

const readJsonArray = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getRecommendations = async (userId) => {
  const recommendationFile = path.join(outputDir, "recommendations.json");
  const records = readJsonArray(recommendationFile);

  const userRecords = records.filter((item) => String(item.userId) === String(userId));
  if (userRecords.length) {
    return userRecords
      .sort((a, b) => toSafeNumber(b.score) - toSafeNumber(a.score))
      .slice(0, 5);
  }

  const fallback = await Order.aggregate([
    { $match: { user: userId } },
    { $group: { _id: "$restaurant", score: { $sum: 1 } } },
    { $sort: { score: -1 } },
    { $limit: 5 },
  ]);

  if (!fallback.length) {
    return [];
  }

  const restaurantIds = fallback.map((item) => item._id);
  const restaurants = await Restaurant.find({ _id: { $in: restaurantIds } }).select("name");
  const nameMap = new Map(restaurants.map((item) => [String(item._id), item.name]));

  return fallback.map((item, index) => ({
    userId: String(userId),
    restaurantId: String(item._id),
    restaurantName: nameMap.get(String(item._id)) || "Recommended Restaurant",
    score: item.score,
    rank: index + 1,
    source: "fallback_aggregate",
  }));
};

const getDemandPrediction = async (restaurantId) => {
  const demandFile = path.join(outputDir, "demand_forecast.json");
  const records = readJsonArray(demandFile);

  const demandRecords = records.filter((item) => String(item.restaurantId) === String(restaurantId));
  if (demandRecords.length) {
    const sorted = demandRecords.sort((a, b) => toSafeNumber(a.hour_of_day, 0) - toSafeNumber(b.hour_of_day, 0));
    const peak = sorted.reduce((best, current) => {
      return toSafeNumber(current.expected_orders, 0) > toSafeNumber(best.expected_orders, 0) ? current : best;
    }, sorted[0]);

    return {
      source: "spark",
      forecast: sorted,
      peakHour: toSafeNumber(peak.hour_of_day, 0),
      expectedOrdersAtPeak: toSafeNumber(peak.expected_orders, 0),
    };
  }

  const fallback = await Order.aggregate([
    { $match: { restaurant: restaurantId } },
    {
      $group: {
        _id: { hourOfDay: { $hour: "$createdAt" } },
        expectedOrders: { $sum: 1 },
      },
    },
    { $sort: { "_id.hourOfDay": 1 } },
  ]);

  const forecast = fallback.map((item) => ({
    restaurantId: String(restaurantId),
    hour_of_day: item._id.hourOfDay,
    expected_orders: item.expectedOrders,
  }));

  const peak = forecast.reduce(
    (best, current) =>
      toSafeNumber(current.expected_orders, 0) > toSafeNumber(best.expected_orders, -1) ? current : best,
    { hour_of_day: 0, expected_orders: 0 }
  );

  return {
    source: "fallback_aggregate",
    forecast,
    peakHour: toSafeNumber(peak.hour_of_day, 0),
    expectedOrdersAtPeak: toSafeNumber(peak.expected_orders, 0),
  };
};

const estimateDeliveryTime = ({ distanceKm, itemCount, hourOfDay }) => {
  const modelFile = path.join(outputDir, "delivery_eta_model.json");
  const modelRecords = readJsonArray(modelFile);

  const features = {
    distanceKm: toSafeNumber(distanceKm, 4),
    itemCount: toSafeNumber(itemCount, 2),
    hourOfDay: toSafeNumber(hourOfDay, new Date().getHours()),
  };

  if (modelRecords.length) {
    const model = modelRecords[0];
    const predicted =
      toSafeNumber(model.intercept, 18) +
      toSafeNumber(model.distanceKmCoeff, 6) * features.distanceKm +
      toSafeNumber(model.itemCountCoeff, 2) * features.itemCount +
      toSafeNumber(model.hourCoeff, 0.2) * features.hourOfDay;

    return {
      source: "spark_model",
      estimatedMinutes: Math.max(15, Math.round(predicted)),
      features,
      model: {
        rmse: toSafeNumber(model.rmse, 0),
      },
    };
  }

  const predicted = 18 + features.distanceKm * 6 + features.itemCount * 2 + features.hourOfDay * 0.2;
  return {
    source: "heuristic_fallback",
    estimatedMinutes: Math.max(15, Math.round(predicted)),
    features,
  };
};

module.exports = {
  getRecommendations,
  getDemandPrediction,
  estimateDeliveryTime,
};
