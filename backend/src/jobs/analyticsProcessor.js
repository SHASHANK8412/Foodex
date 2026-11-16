const { analyticsQueue } = require("../queues");
const analyticsService = require("../services/analyticsService");
const Order = require("../models/Order");
const RestaurantAnalytics = require("../models/RestaurantAnalytics");
const { ORDER_STATUS } = require("../constants/order");

const processRestaurantAggregation = async () => {
  console.log("Starting hourly restaurant analytics aggregation...");
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const aggregation = await Order.aggregate([
    {
      $match: {
        status: ORDER_STATUS.DELIVERED,
        createdAt: { $gte: oneHourAgo },
      },
    },
    {
      $group: {
        _id: "$restaurant",
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);

  for (const result of aggregation) {
    const restaurantId = result._id;
    const period = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH

    await RestaurantAnalytics.findOneAndUpdate(
      { restaurant: restaurantId, period },
      {
        $inc: {
          totalOrders: result.totalOrders,
          totalRevenue: result.totalRevenue,
        },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Analytics aggregation complete for ${aggregation.length} restaurants.`);
};

analyticsQueue.process(async (job) => {
  const { event, data } = job.data;

  if (job.name === "aggregate-restaurant-analytics") {
    await processRestaurantAggregation();
    return;
  }

  // This is a placeholder. In a real app, you'd have a more complex
  // analytics service that would handle different events.
  console.log(`📈 Analytics Event: ${event}`, data);
  await analyticsService.track(event, data);
});

analyticsQueue.on("failed", (job, err) => {
  console.error(`Analytics job ${job.id} failed with error: ${err.message}`);
});

console.log("📈 Analytics processor started");
