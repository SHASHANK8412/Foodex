const Payment = require("../models/Payment");

const buildDateRange = (from, to) => {
  if (!from && !to) {
    return null;
  }

  const range = {};
  if (from) {
    range.$gte = new Date(from);
  }
  if (to) {
    range.$lte = new Date(to);
  }
  return range;
};

const getPaymentDashboard = async ({ from, to, userId, restaurantId, status }) => {
  const query = {};

  const dateRange = buildDateRange(from, to);
  if (dateRange) {
    query.createdAt = dateRange;
  }

  if (userId) {
    query.user = userId;
  }
  if (restaurantId) {
    query.restaurant = restaurantId;
  }
  if (status) {
    query.status = status;
  }

  const [transactions, totals, dailySeries, monthlySeries] = await Promise.all([
    Payment.find(query)
      .populate("user", "name email")
      .populate("restaurant", "name")
      .populate("order", "shortId status")
      .sort({ createdAt: -1 })
      .limit(200),
    Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          grossRevenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
          totalTransactions: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
        },
      },
    ]),
    Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]),
    Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: { month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } } },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]),
  ]);

  const summary = totals[0] || {
    grossRevenue: 0,
    totalTransactions: 0,
    successCount: 0,
    failedCount: 0,
  };

  return {
    summary,
    dailySeries: dailySeries.map((item) => ({
      date: item._id.day,
      revenue: item.revenue,
      count: item.count,
    })),
    monthlySeries: monthlySeries.map((item) => ({
      month: item._id.month,
      revenue: item.revenue,
      count: item.count,
    })),
    transactions,
  };
};

module.exports = {
  getPaymentDashboard,
};
