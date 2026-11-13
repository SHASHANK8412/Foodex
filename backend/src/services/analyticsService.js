const mongoose = require("mongoose");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const { readDataset } = require("./sparkOutputStore");

// Serves the features built by the Spark batch job. Each function falls back to
// a MongoDB aggregate or a heuristic when the job has not produced that dataset,
// and reports which source answered in the `source` field.

const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toObjectId = (value) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;

const track = async (event, data) => {
  // In a real application, this would send data to a dedicated analytics service
  // like Segment, Mixpanel, or a data warehouse. For this example, we'll just log it.
  console.log(`[ANALYTICS EVENT] ${event}:`, JSON.stringify(data, null, 2));
  return Promise.resolve();
};

const restaurantNamesById = async (ids) => {
  const validIds = ids.map(toObjectId).filter(Boolean);
  if (!validIds.length) {
    return new Map();
  }

  const restaurants = await Restaurant.find({ _id: { $in: validIds } }).select("name");
  return new Map(restaurants.map((item) => [String(item._id), item.name]));
};

const getRecommendations = async (userId) => {
  const sparkRows = readDataset("recommendations")
    .filter((item) => String(item.userId) === String(userId))
    .sort((a, b) => toSafeNumber(a.rank, 99) - toSafeNumber(b.rank, 99));

  if (sparkRows.length) {
    // Only recommend restaurants that still exist in the live catalogue.
    const names = await restaurantNamesById(sparkRows.map((item) => item.restaurantId));
    const live = sparkRows.filter((item) => names.has(String(item.restaurantId))).slice(0, 5);

    if (live.length) {
      return live.map((item, index) => ({
        userId: String(userId),
        restaurantId: String(item.restaurantId),
        restaurantName: names.get(String(item.restaurantId)),
        score: Number(toSafeNumber(item.score).toFixed(3)),
        rank: index + 1,
        source: item.source || "spark_als",
      }));
    }
  }

  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    return [];
  }

  const fallback = await Order.aggregate([
    { $match: { user: userObjectId } },
    { $group: { _id: "$restaurant", score: { $sum: 1 } } },
    { $sort: { score: -1 } },
    { $limit: 5 },
  ]);

  if (!fallback.length) {
    return [];
  }

  const names = await restaurantNamesById(fallback.map((item) => item._id));

  return fallback.map((item, index) => ({
    userId: String(userId),
    restaurantId: String(item._id),
    restaurantName: names.get(String(item._id)) || "Recommended Restaurant",
    score: item.score,
    rank: index + 1,
    source: "fallback_aggregate",
  }));
};

const summarizeForecast = (source, forecast) => {
  const peak = forecast.reduce(
    (best, current) =>
      toSafeNumber(current.expected_orders, 0) > toSafeNumber(best.expected_orders, -1) ? current : best,
    { hour_of_day: 0, expected_orders: 0 }
  );

  return {
    source,
    forecast,
    peakHour: toSafeNumber(peak.hour_of_day, 0),
    expectedOrdersAtPeak: toSafeNumber(peak.expected_orders, 0),
  };
};

const getDemandPrediction = async (restaurantId) => {
  const sparkRows = readDataset("demand_forecast")
    .filter((item) => String(item.restaurantId) === String(restaurantId))
    .sort((a, b) => toSafeNumber(a.hour_of_day, 0) - toSafeNumber(b.hour_of_day, 0));

  if (sparkRows.length) {
    return summarizeForecast("spark", sparkRows);
  }

  const restaurantObjectId = toObjectId(restaurantId);
  if (!restaurantObjectId) {
    return summarizeForecast("fallback_aggregate", []);
  }

  const fallback = await Order.aggregate([
    { $match: { restaurant: restaurantObjectId } },
    {
      $group: {
        _id: { hourOfDay: { $hour: "$createdAt" } },
        expectedOrders: { $sum: 1 },
      },
    },
    { $sort: { "_id.hourOfDay": 1 } },
  ]);

  return summarizeForecast(
    "fallback_aggregate",
    fallback.map((item) => ({
      restaurantId: String(restaurantId),
      hour_of_day: item._id.hourOfDay,
      expected_orders: item.expectedOrders,
    }))
  );
};

const estimateDeliveryTime = ({ distanceKm, itemCount, hourOfDay }) => {
  const features = {
    distanceKm: toSafeNumber(distanceKm, 4),
    itemCount: toSafeNumber(itemCount, 2),
    hourOfDay: toSafeNumber(hourOfDay, new Date().getHours()),
  };

  // The Spark job trains a linear regression and exports its coefficients, so
  // the API can score a request without a Spark runtime.
  const model = readDataset("delivery_eta_model")[0];

  if (model && Number.isFinite(Number(model.intercept))) {
    const predicted =
      toSafeNumber(model.intercept) +
      toSafeNumber(model.distanceKmCoeff) * features.distanceKm +
      toSafeNumber(model.itemCountCoeff) * features.itemCount +
      toSafeNumber(model.hourCoeff) * features.hourOfDay;

    return {
      source: "spark_model",
      estimatedMinutes: Math.max(15, Math.round(predicted)),
      features,
      model: {
        rmse: toSafeNumber(model.rmse, 0),
        r2: toSafeNumber(model.r2, 0),
        trainRows: toSafeNumber(model.trainRows, 0),
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
  track,
  estimateDeliveryTime,
};
