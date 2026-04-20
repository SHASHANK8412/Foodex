const cron = require("node-cron");
const MenuItem = require("../models/MenuItem");

const resolveWindowByHour = (hour) => {
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 17) return "lunch";
  if (hour >= 17 && hour < 23) return "dinner";
  return "all_day";
};

const syncMenuAvailability = async () => {
  const hour = new Date().getHours();
  const currentWindow = resolveWindowByHour(hour);

  await MenuItem.updateMany(
    { availabilityWindow: "all_day" },
    { $set: { isAvailable: true } }
  );

  await MenuItem.updateMany(
    {
      availabilityWindow: {
        $in: ["breakfast", "lunch", "dinner"],
        $ne: currentWindow,
      },
    },
    { $set: { isAvailable: false } }
  );

  await MenuItem.updateMany(
    { availabilityWindow: currentWindow },
    { $set: { isAvailable: true } }
  );
};

const startMenuAvailabilityCron = () => {
  syncMenuAvailability().catch((error) => {
    console.error("Initial menu availability sync failed:", error.message);
  });

  cron.schedule("*/15 * * * *", async () => {
    try {
      await syncMenuAvailability();
    } catch (error) {
      console.error("Menu availability cron failed:", error.message);
    }
  });

  console.log("Menu availability cron started: every 15 minutes");
};

module.exports = {
  startMenuAvailabilityCron,
  syncMenuAvailability,
};
