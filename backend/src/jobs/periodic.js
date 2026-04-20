const { analyticsQueue } = require("../queues");

const schedulePeriodicJobs = () => {
  // Schedule a job to run every hour to aggregate restaurant analytics
  analyticsQueue.add(
    "aggregate-restaurant-analytics",
    {},
    {
      repeat: {
        cron: "0 * * * *", // Every hour at minute 0
      },
      jobId: "hourly-restaurant-analytics-aggregation", // A unique ID to prevent duplicates
    }
  );

  console.log("📊 Periodic jobs scheduled.");
};

module.exports = {
  schedulePeriodicJobs,
};
