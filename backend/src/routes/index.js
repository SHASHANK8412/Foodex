const express = require("express");
const swaggerUi = require("swagger-ui-express");
const { liveness, readiness } = require("../observability/health");
const openapiSpec = require("../docs/openapi");
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
const adminPaymentsRoutes = require("./adminPaymentsRoutes");
const reviewRoutes = require("./reviewRoutes");
const groupOrderRoutes = require("./groupOrderRoutes");
const pipelineRoutes = require("./pipelineRoutes");
const eventRoutes = require("./eventRoutes");
const pricingRoutes = require("./pricingRoutes");
const agentRoutes = require("./agentRoutes");

const router = express.Router();

// Liveness (process up) and readiness (dependencies reachable), for load
// balancers and orchestrators. /health is kept for existing clients.
router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Foodex API is healthy", ...liveness() });
});
router.get("/health/live", (_req, res) => res.json(liveness()));
router.get("/health/ready", async (_req, res) => {
  const result = await readiness();
  res.status(result.ready ? 200 : 503).json(result);
});

// Interactive API reference (OpenAPI 3.1).
router.get("/docs/openapi.json", (_req, res) => res.json(openapiSpec));
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: "Foodex API" }));

router.use("/auth", authRoutes);
router.use("/restaurants", restaurantRoutes);
router.use("/orders", orderRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/ai", aiRoutes);
router.use("/loyalty", loyaltyRoutes);
router.use("/owner", ownerRoutes);
router.use("/admin/analytics", analyticsSuiteRoutes);
router.use("/admin/payments", adminPaymentsRoutes);
router.use("/menu", menuRoutes);
router.use("/reviews", reviewRoutes);
router.use("/group-orders", groupOrderRoutes);
router.use("/pipeline", pipelineRoutes);
router.use("/events", eventRoutes);
router.use("/pricing", pricingRoutes);
router.use("/agent", agentRoutes);

module.exports = router;
