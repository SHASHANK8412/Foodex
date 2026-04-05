const express = require("express");
const authRoutes = require("./authRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const orderRoutes = require("./orderRoutes");
const deliveryRoutes = require("./deliveryRoutes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Foodex API is healthy",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/orders", orderRoutes);
router.use("/delivery", deliveryRoutes);

module.exports = router;
