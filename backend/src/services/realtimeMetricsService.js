const KAFKA_TOPICS = require("../constants/kafkaTopics");
const { getIO } = require("../sockets/socketManager");

// Rolling one-minute windows over the event stream, shown live on the admin
// Data Pipeline page.
//
// Two engines can fill the windows:
//   - "spark-structured-streaming": windowed aggregates computed by the Spark job
//     (analytics/jobs/streaming_pipeline.py) and published to the
//     foodex.analytics.realtime topic, which the API consumes back.
//   - "node-in-process": the same aggregation done in this process, so the page
//     still works when Kafka or Spark is not running.
// The snapshot always says which engine produced it.

const WINDOW_MS = 60 * 1000;
const RETAIN_WINDOWS = 60;
const SERIES_WINDOWS = 30;
const RANKING_WINDOWS = 15;
const SPARK_FRESH_MS = 3 * 60 * 1000;
const BROADCAST_INTERVAL_MS = 2000;

const ENGINES = {
  SPARK: "spark-structured-streaming",
  NODE: "node-in-process",
};

const FUNNEL_STAGES = [
  "page_view",
  "restaurant_view",
  "add_to_cart",
  "checkout_started",
  "order_placed",
  "payment_completed",
];

const createStore = () => ({ orders: new Map(), items: new Map(), funnel: new Map() });

const nodeStore = createStore();
const sparkStore = createStore();
const sparkState = { lastRecordAt: 0, recordsReceived: 0 };

let broadcastTimer = null;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const windowStartOf = (timestamp) => {
  const parsed = Date.parse(timestamp);
  const time = Number.isFinite(parsed) ? parsed : Date.now();
  return Math.floor(time / WINDOW_MS) * WINDOW_MS;
};

const prune = (store, now) => {
  const cutoff = now - RETAIN_WINDOWS * WINDOW_MS;
  [store.orders, store.items, store.funnel].forEach((map) => {
    map.forEach((row, key) => {
      if (row.windowStart < cutoff) {
        map.delete(key);
      }
    });
  });
};

const scheduleBroadcast = () => {
  if (broadcastTimer) {
    return;
  }

  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    const io = getIO();
    if (io) {
      io.to("role:admin").emit("pipeline:realtime", getSnapshot());
    }
  }, BROADCAST_INTERVAL_MS);

  // Never keep the process (or a test run) alive just for a dashboard refresh.
  broadcastTimer.unref?.();
};

const addOrder = (store, windowStart, { restaurantId, restaurantName, orders, revenue }) => {
  const id = String(restaurantId || "unknown");
  const key = `${windowStart}|${id}`;
  const row = store.orders.get(key) || {
    windowStart,
    restaurantId: id,
    restaurantName: restaurantName || "",
    orders: 0,
    revenue: 0,
  };
  row.orders += orders;
  row.revenue += revenue;
  if (restaurantName) {
    row.restaurantName = restaurantName;
  }
  store.orders.set(key, row);
};

const addItem = (store, windowStart, itemName, quantity) => {
  if (!itemName) {
    return;
  }
  const key = `${windowStart}|${itemName}`;
  const row = store.items.get(key) || { windowStart, itemName, quantity: 0 };
  row.quantity += quantity;
  store.items.set(key, row);
};

const addFunnel = (store, windowStart, stage, events) => {
  if (!stage) {
    return;
  }
  const key = `${windowStart}|${stage}`;
  const row = store.funnel.get(key) || { windowStart, stage, events: 0 };
  row.events += events;
  store.funnel.set(key, row);
};

// Called for every event the API publishes (node-in-process engine).
const ingestEvent = (topic, event) => {
  if (!event) {
    return;
  }

  const windowStart = windowStartOf(event.occurredAt);

  if (topic === KAFKA_TOPICS.ORDER_CREATED) {
    addOrder(nodeStore, windowStart, {
      restaurantId: event.restaurantId,
      restaurantName: event.restaurantName,
      orders: 1,
      revenue: toNumber(event.totalAmount),
    });
    (Array.isArray(event.items) ? event.items : []).forEach((item) => {
      addItem(nodeStore, windowStart, item?.name, toNumber(item?.quantity) || 1);
    });
    addFunnel(nodeStore, windowStart, "order_placed", 1);
  } else if (topic === KAFKA_TOPICS.ORDER_PAID) {
    addFunnel(nodeStore, windowStart, "payment_completed", 1);
  } else if (topic === KAFKA_TOPICS.CLICKSTREAM) {
    addFunnel(nodeStore, windowStart, event.action, 1);
  } else {
    return;
  }

  scheduleBroadcast();
};

// Called for every record Spark publishes to foodex.analytics.realtime.
// Spark runs in "update" output mode, so a record replaces the previous value
// for the same window and dimension instead of adding to it.
const ingestSparkRecord = (record) => {
  if (!record || !record.metric) {
    return false;
  }

  const parsed = Date.parse(record.windowStart);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  const windowStart = Math.floor(parsed / WINDOW_MS) * WINDOW_MS;

  if (record.metric === "order_window") {
    const id = String(record.restaurantId || "unknown");
    sparkStore.orders.set(`${windowStart}|${id}`, {
      windowStart,
      restaurantId: id,
      restaurantName: record.restaurantName || "",
      orders: toNumber(record.orders),
      revenue: toNumber(record.revenue),
    });
  } else if (record.metric === "trending_item") {
    if (!record.itemName) {
      return false;
    }
    sparkStore.items.set(`${windowStart}|${record.itemName}`, {
      windowStart,
      itemName: record.itemName,
      quantity: toNumber(record.quantity),
    });
  } else if (record.metric === "funnel") {
    if (!record.stage) {
      return false;
    }
    sparkStore.funnel.set(`${windowStart}|${record.stage}`, {
      windowStart,
      stage: record.stage,
      events: toNumber(record.events),
    });
  } else {
    return false;
  }

  sparkState.lastRecordAt = Date.now();
  sparkState.recordsReceived += 1;
  scheduleBroadcast();
  return true;
};

const topN = (map, valueKey, limit) =>
  [...map.values()].sort((a, b) => b[valueKey] - a[valueKey]).slice(0, limit);

function getSnapshot() {
  const now = Date.now();
  const sparkIsLive = sparkState.lastRecordAt > 0 && now - sparkState.lastRecordAt < SPARK_FRESH_MS;
  const store = sparkIsLive ? sparkStore : nodeStore;

  prune(nodeStore, now);
  prune(sparkStore, now);

  const currentWindow = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const seriesStart = currentWindow - (SERIES_WINDOWS - 1) * WINDOW_MS;
  const rankingStart = currentWindow - (RANKING_WINDOWS - 1) * WINDOW_MS;

  const perWindow = new Map();
  const restaurants = new Map();
  store.orders.forEach((row) => {
    if (row.windowStart >= seriesStart) {
      const bucket = perWindow.get(row.windowStart) || { orders: 0, revenue: 0 };
      bucket.orders += row.orders;
      bucket.revenue += row.revenue;
      perWindow.set(row.windowStart, bucket);
    }

    if (row.windowStart >= rankingStart) {
      const entry = restaurants.get(row.restaurantId) || {
        restaurantId: row.restaurantId,
        restaurantName: row.restaurantName,
        orders: 0,
        revenue: 0,
      };
      entry.orders += row.orders;
      entry.revenue += row.revenue;
      entry.restaurantName = entry.restaurantName || row.restaurantName;
      restaurants.set(row.restaurantId, entry);
    }
  });

  const series = [];
  let totalOrders = 0;
  let totalRevenue = 0;
  for (let index = 0; index < SERIES_WINDOWS; index += 1) {
    const windowStart = seriesStart + index * WINDOW_MS;
    const bucket = perWindow.get(windowStart) || { orders: 0, revenue: 0 };
    totalOrders += bucket.orders;
    totalRevenue += bucket.revenue;
    series.push({
      windowStart: new Date(windowStart).toISOString(),
      orders: bucket.orders,
      revenue: Number(bucket.revenue.toFixed(2)),
    });
  }

  const items = new Map();
  store.items.forEach((row) => {
    if (row.windowStart >= rankingStart) {
      const entry = items.get(row.itemName) || { itemName: row.itemName, quantity: 0 };
      entry.quantity += row.quantity;
      items.set(row.itemName, entry);
    }
  });

  const stages = new Map(FUNNEL_STAGES.map((stage) => [stage, 0]));
  let totalEvents = 0;
  store.funnel.forEach((row) => {
    if (row.windowStart >= seriesStart && stages.has(row.stage)) {
      stages.set(row.stage, stages.get(row.stage) + row.events);
      totalEvents += row.events;
    }
  });

  return {
    engine: sparkIsLive ? ENGINES.SPARK : ENGINES.NODE,
    generatedAt: new Date(now).toISOString(),
    windowSeconds: WINDOW_MS / 1000,
    seriesMinutes: SERIES_WINDOWS,
    rankingMinutes: RANKING_WINDOWS,
    totals: {
      orders: totalOrders,
      revenue: Number(totalRevenue.toFixed(2)),
      events: totalEvents,
    },
    series,
    topRestaurants: topN(restaurants, "orders", 5).map((row) => ({
      ...row,
      revenue: Number(row.revenue.toFixed(2)),
    })),
    trendingItems: topN(items, "quantity", 8),
    funnel: FUNNEL_STAGES.map((stage) => ({ stage, events: stages.get(stage) })),
    spark: {
      live: sparkIsLive,
      lastRecordAt: sparkState.lastRecordAt ? new Date(sparkState.lastRecordAt).toISOString() : null,
      recordsReceived: sparkState.recordsReceived,
    },
  };
}

const reset = () => {
  [nodeStore, sparkStore].forEach((store) => {
    store.orders.clear();
    store.items.clear();
    store.funnel.clear();
  });
  sparkState.lastRecordAt = 0;
  sparkState.recordsReceived = 0;
  if (broadcastTimer) {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
  }
};

module.exports = {
  ENGINES,
  FUNNEL_STAGES,
  ingestEvent,
  ingestSparkRecord,
  getSnapshot,
  reset,
};
