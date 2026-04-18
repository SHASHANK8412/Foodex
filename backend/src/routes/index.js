const express = require("express");
const authRoutes = require("./authRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const orderRoutes = require("./orderRoutes");
const deliveryRoutes = require("./deliveryRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const aiRoutes = require("./aiRoutes");
const loyaltyRoutes = require("./loyaltyRoutes");
const ownerRoutes = require("./ownerRoutes");
const analyticsSuiteRoutes = require("./analyticsSuiteRoutes");
const menuRoutes = require("./menuRoutes");

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
router.use("/analytics", analyticsRoutes);
router.use("/ai", aiRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/owner", ownerRoutes);
router.use("/admin/analytics", analyticsSuiteRoutes);
router.use("/menu", menuRoutes);

module.exports = router;
