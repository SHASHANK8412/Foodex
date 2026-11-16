const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const env = require("../config/env");
const KAFKA_TOPICS = require("../constants/kafkaTopics");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");
const { publishBatch, getKafkaStatus } = require("../kafka");
const pipelineMetrics = require("../kafka/pipelineMetrics");
const realtimeMetrics = require("./realtimeMetricsService");
const { readDataset, hasDataset, readManifest } = require("./sparkOutputStore");

const CLICKSTREAM_ACTIONS = [
  "page_view",
  "restaurant_view",
  "add_to_cart",
  "remove_from_cart",
  "search",
  "checkout_started",
];

const GOLD_DATASETS = [
  "recommendations",
  "demand_forecast",
  "delivery_eta_model",
  "customer_segments",
  "basket_rules",
  "top_items",
  "restaurant_kpis",
  "hourly_heatmap",
];

const MAX_CLICKSTREAM_BATCH = 50;
const MAX_SIMULATED_ORDERS = 500;
const TAX_RATE = 0.05;
const DELIVERY_FEE = 40;

const clip = (value, max) => (typeof value === "string" && value ? value.slice(0, max) : undefined);

// --- Clickstream ingestion -------------------------------------------------

// Validates browser events and publishes them to the clickstream topic.
// Only whitelisted actions and a fixed set of short fields are accepted.
const ingestClickstream = async ({ sessionId, events, userId }) => {
  const session = clip(sessionId, 64);
  if (!session || !Array.isArray(events)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "sessionId and an events array are required");
  }

  const payloads = events
    .slice(0, MAX_CLICKSTREAM_BATCH)
    .filter((event) => event && CLICKSTREAM_ACTIONS.includes(event.action))
    .map((event) => ({
      sessionId: session,
      userId: userId ? String(userId) : undefined,
      action: event.action,
      path: clip(event.path, 200),
      restaurantId: clip(event.restaurantId, 64),
      menuItemId: clip(event.menuItemId, 64),
      query: clip(event.query, 120),
      clientTs: clip(event.clientTs, 40),
    }));

  if (!payloads.length) {
    return { accepted: 0, transport: "none" };
  }

  const result = await publishBatch(KAFKA_TOPICS.CLICKSTREAM, payloads);
  return { accepted: result.count, transport: result.transport };
};

// --- Pipeline status -------------------------------------------------------

const directoryExists = (target) => {
  try {
    return fs.statSync(target).isDirectory();
  } catch (_error) {
    return false;
  }
};

const getLakeStatus = () => ({
  bronze: directoryExists(path.join(env.analyticsLakeDir, "bronze", "events")),
  silver: directoryExists(path.join(env.analyticsLakeDir, "silver", "orders")),
  gold: GOLD_DATASETS.filter((name) => hasDataset(name)),
});

const getStatus = async () => {
  const manifest = readManifest();
  const realtime = realtimeMetrics.getSnapshot();

  return {
    generatedAt: new Date().toISOString(),
    kafka: await getKafkaStatus(),
    events: pipelineMetrics.getSnapshot(),
    streaming: {
      engine: realtime.engine,
      sparkLive: realtime.spark.live,
      lastSparkRecordAt: realtime.spark.lastRecordAt,
      sparkRecordsReceived: realtime.spark.recordsReceived,
    },
    batch: manifest
      ? {
          available: true,
          generatedAt: manifest.generatedAt || null,
          datasetLabel: manifest.datasetLabel || "unspecified",
          sparkVersion: manifest.sparkVersion || null,
          counts: manifest.counts || {},
          durationSeconds: manifest.durationSeconds ?? null,
        }
      : { available: false },
    lake: getLakeStatus(),
  };
};

// --- Spark batch insights --------------------------------------------------

const byDesc = (key) => (a, b) => Number(b[key] || 0) - Number(a[key] || 0);

const getBatchInsights = () => {
  const manifest = readManifest();
  const segments = [...readDataset("customer_segments")].sort(byDesc("customers"));
  const basketRules = [...readDataset("basket_rules")].sort(byDesc("lift")).slice(0, 15);
  const topItems = [...readDataset("top_items")].sort(byDesc("quantity")).slice(0, 10);
  const restaurantKpis = [...readDataset("restaurant_kpis")].sort(byDesc("revenue")).slice(0, 10);
  const heatmap = readDataset("hourly_heatmap");
  const etaModel = readDataset("delivery_eta_model")[0] || null;

  const available = Boolean(
    manifest || segments.length || basketRules.length || topItems.length || restaurantKpis.length
  );

  return {
    available,
    manifest,
    segments,
    basketRules,
    topItems,
    restaurantKpis,
    heatmap,
    etaModel,
  };
};

// --- Traffic simulator -----------------------------------------------------

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Publishes realistic synthetic sessions and orders through the event bus so the
// pipeline can be demonstrated end to end. Events carry `synthetic: true`:
// analytics consumers count them, but no order is written to MongoDB and no
// notification or delivery assignment is triggered.
const simulateTraffic = async ({ orders = 25 } = {}) => {
  const orderCount = Math.min(MAX_SIMULATED_ORDERS, Math.max(1, Math.floor(Number(orders) || 25)));

  const restaurants = await Restaurant.find({}).select("name address.city").lean();
  const menuItems = await MenuItem.find({ restaurant: { $in: restaurants.map((item) => item._id) } })
    .select("name price restaurant")
    .lean();

  const menuByRestaurant = new Map();
  menuItems.forEach((item) => {
    const key = String(item.restaurant);
    menuByRestaurant.set(key, [...(menuByRestaurant.get(key) || []), item]);
  });

  const candidates = restaurants.filter((item) => menuByRestaurant.has(String(item._id)));
  if (!candidates.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No restaurants with menu items found. Run `npm run seed:demo` first."
    );
  }

  const clicks = [];
  const created = [];
  const paid = [];

  // Not every visitor orders: add browse-only sessions so the funnel narrows.
  const sessions = Math.round(orderCount * 1.6);

  for (let index = 0; index < sessions; index += 1) {
    const sessionId = `sim-${crypto.randomUUID().slice(0, 12)}`;
    const userId = new mongoose.Types.ObjectId().toString();
    const restaurant = pick(candidates);
    const restaurantId = String(restaurant._id);
    const menu = menuByRestaurant.get(restaurantId);
    const click = (action, extra = {}) =>
      clicks.push({ sessionId, userId, action, synthetic: true, ...extra });

    click("page_view", { path: "/" });
    click("restaurant_view", { path: `/restaurants/${restaurantId}`, restaurantId });

    const places = index < orderCount;
    if (!places) {
      if (Math.random() < 0.5) {
        click("add_to_cart", { restaurantId, menuItemId: String(pick(menu)._id) });
      }
      continue;
    }

    const lines = new Map();
    const lineCount = 1 + Math.floor(Math.random() * 3);
    for (let line = 0; line < lineCount; line += 1) {
      const item = pick(menu);
      const key = String(item._id);
      const existing = lines.get(key);
      lines.set(key, {
        menuItemId: key,
        name: item.name,
        price: item.price,
        quantity: (existing?.quantity || 0) + 1,
      });
      click("add_to_cart", { restaurantId, menuItemId: key });
    }
    click("checkout_started", { path: "/checkout", restaurantId });

    const items = [...lines.values()];
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalAmount = Number((subtotal * (1 + TAX_RATE) + DELIVERY_FEE).toFixed(2));
    const order = {
      orderId: new mongoose.Types.ObjectId().toString(),
      userId,
      restaurantId,
      restaurantName: restaurant.name,
      city: restaurant.address?.city || "",
      totalAmount,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      synthetic: true,
    };

    created.push({ ...order, paymentStatus: "pending" });
    if (Math.random() < 0.85) {
      paid.push({
        orderId: order.orderId,
        userId,
        restaurantId,
        totalAmount,
        paymentStatus: "paid",
        synthetic: true,
      });
    }
  }

  const results = [
    await publishBatch(KAFKA_TOPICS.CLICKSTREAM, clicks),
    await publishBatch(KAFKA_TOPICS.ORDER_CREATED, created),
    await publishBatch(KAFKA_TOPICS.ORDER_PAID, paid),
  ];

  return {
    orders: created.length,
    paidOrders: paid.length,
    clickEvents: clicks.length,
    totalEvents: clicks.length + created.length + paid.length,
    transport: results.every((result) => result.transport === "kafka" || result.count === 0)
      ? "kafka"
      : "in-process",
  };
};

module.exports = {
  CLICKSTREAM_ACTIONS,
  ingestClickstream,
  getStatus,
  getBatchInsights,
  simulateTraffic,
  getRealtimeSnapshot: realtimeMetrics.getSnapshot,
};
