const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const { emitDemandUpdate } = require("../sockets/socketManager");

// Orders the kitchen is working on. Unpaid ("pending") orders are not: an
// abandoned checkout must not make a restaurant look busy, and an order that
// has left with the rider no longer takes kitchen time.
const ACTIVE_STATUSES = ["confirmed", "preparing"];

const computeDemand = (activeOrders, avgPrepMinutes = 22) => {
  let demandLevel = "low";
  if (activeOrders >= 12) {
    demandLevel = "high";
  } else if (activeOrders >= 6) {
    demandLevel = "medium";
  }

  const surgeFactor = demandLevel === "high" ? 1.55 : demandLevel === "medium" ? 1.25 : 1;
  const estimatedWaitMinutes = Math.max(15, Math.round(avgPrepMinutes * surgeFactor + activeOrders * 1.8));

  return { demandLevel, estimatedWaitMinutes };
};

const refreshRestaurantDemand = async (restaurantId) => {
  if (!restaurantId) {
    return null;
  }

  const activeOrders = await Order.countDocuments({
    restaurant: restaurantId,
    status: { $in: ACTIVE_STATUSES },
  });

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    return null;
  }

  const { demandLevel, estimatedWaitMinutes } = computeDemand(activeOrders, restaurant.avgPrepMinutes);

  restaurant.activeOrders = activeOrders;
  restaurant.demandLevel = demandLevel;
  restaurant.estimatedWaitMinutes = estimatedWaitMinutes;
  await restaurant.save();

  emitDemandUpdate({
    restaurantId: String(restaurant._id),
    activeOrders,
    demandLevel,
    estimatedWaitMinutes,
  });

  return restaurant;
};

module.exports = {
  refreshRestaurantDemand,
};
