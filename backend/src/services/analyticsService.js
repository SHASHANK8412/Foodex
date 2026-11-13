const mongoose = require("mongoose");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const { readDataset } = require("./sparkOutputStore");

// Serves the features built by the Spark batch job. Each function falls back to
// a MongoDB aggregate or a heuristic when the job has not produced that dataset,
// and reports which source answered in the `source` field.

// Hour-of-day features use the restaurants' local time (the Spark job uses the same zone).
const LOCAL_TIMEZONE = process.env.ANALYTICS_TIMEZONE || "Asia/Kolkata";

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
        _id: { hourOfDay: { $hour: { date: "$createdAt", timezone: LOCAL_TIMEZONE } } },
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

// Dishes to suggest alongside a cart. Uses the FP-Growth association rules from
// the Spark batch job when any match this restaurant's menu, otherwise counts
// what was ordered together with the cart's items in past orders.
const getFrequentlyBoughtTogether = async ({ restaurantId, menuItemIds = [], limit = 3 }) => {
  const restaurantObjectId = toObjectId(restaurantId);
  const cartIds = menuItemIds.map(String).filter((id) => mongoose.isValidObjectId(id));
  if (!restaurantObjectId || !cartIds.length) {
    return { source: "none", suggestions: [] };
  }

  const menu = await MenuItem.find({ restaurant: restaurantObjectId, isAvailable: true })
    .select("name price isVeg imageUrl")
    .lean();
  const byName = new Map(menu.map((item) => [item.name, item]));
  const cartNames = new Set(menu.filter((item) => cartIds.includes(String(item._id))).map((item) => item.name));

  const toSuggestion = (item, extra) => ({
    menuItemId: String(item._id),
    name: item.name,
    price: item.price,
    isVeg: Boolean(item.isVeg),
    imageUrl: item.imageUrl || null,
    ...extra,
  });

  // Spark rules: the whole antecedent is in the cart, the consequent is a single
  // dish on this menu that is not in the cart yet.
  const best = new Map();
  readDataset("basket_rules").forEach((rule) => {
    const antecedent = Array.isArray(rule.antecedent) ? rule.antecedent : [];
    const consequent = Array.isArray(rule.consequent) ? rule.consequent : [];
    if (!antecedent.length || consequent.length !== 1) return;
    if (!antecedent.every((name) => cartNames.has(name))) return;

    const name = consequent[0];
    const item = byName.get(name);
    if (!item || cartNames.has(name)) return;

    const previous = best.get(name);
    if (!previous || toSafeNumber(rule.lift) > previous.lift) {
      best.set(name, { item, confidence: toSafeNumber(rule.confidence), lift: toSafeNumber(rule.lift), because: antecedent });
    }
  });

  if (best.size) {
    return {
      source: "spark_fp_growth",
      suggestions: [...best.values()]
        .sort((a, b) => b.lift - a.lift)
        .slice(0, limit)
        .map((entry) =>
          toSuggestion(entry.item, {
            confidence: Number(entry.confidence.toFixed(3)),
            lift: Number(entry.lift.toFixed(2)),
            because: entry.because,
          })
        ),
    };
  }

  const cartObjectIds = cartIds.map((id) => new mongoose.Types.ObjectId(id));
  const [together, basketCount] = await Promise.all([
    Order.aggregate([
      { $match: { restaurant: restaurantObjectId, "items.menuItem": { $in: cartObjectIds } } },
      { $unwind: "$items" },
      { $match: { "items.menuItem": { $nin: cartObjectIds } } },
      { $group: { _id: "$items.menuItem", orders: { $addToSet: "$_id" } } },
      { $project: { orders: { $size: "$orders" } } },
      { $sort: { orders: -1 } },
      { $limit: limit * 2 },
    ]),
    Order.countDocuments({ restaurant: restaurantObjectId, "items.menuItem": { $in: cartObjectIds } }),
  ]);

  const menuById = new Map(menu.map((item) => [String(item._id), item]));
  return {
    source: "fallback_cooccurrence",
    suggestions: together
      .filter((row) => menuById.has(String(row._id)))
      .slice(0, limit)
      .map((row) =>
        toSuggestion(menuById.get(String(row._id)), {
          confidence: basketCount ? Number((row.orders / basketCount).toFixed(3)) : 0,
          orders: row.orders,
        })
      ),
  };
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
  getFrequentlyBoughtTogether,
  getRecommendations,
  getDemandPrediction,
  track,
  estimateDeliveryTime,
};
