const mongoose = require("mongoose");

const restaurantAnalyticsSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    period: {
      type: String, // e.g., "2026-04-09" for daily, "2026-W15" for weekly
      required: true,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    averageOrderValue: {
      type: Number,
      default: 0,
    },
    // You could add more complex analytics here, like popular items, peak hours, etc.
  },
  { timestamps: true }
);

restaurantAnalyticsSchema.index({ restaurant: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("RestaurantAnalytics", restaurantAnalyticsSchema);
