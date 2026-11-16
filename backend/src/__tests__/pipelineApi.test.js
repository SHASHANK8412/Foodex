process.env.NODE_ENV = "test";
process.env.KAFKA_ENABLED = "false";

const request = require("supertest");
const app = require("../app");
const KAFKA_TOPICS = require("../constants/kafkaTopics");
const realtimeMetrics = require("../services/realtimeMetricsService");
const pipelineMetrics = require("../kafka/pipelineMetrics");

beforeEach(() => {
  realtimeMetrics.reset();
  pipelineMetrics.reset();
});

describe("POST /api/events (clickstream ingestion)", () => {
  test("accepts whitelisted actions and drops everything else", async () => {
    const response = await request(app)
      .post("/api/events")
      .send({
        sessionId: "session-1",
        events: [
          { action: "page_view", path: "/" },
          { action: "add_to_cart", restaurantId: "r1", menuItemId: "m1" },
          { action: "drop_table" },
          null,
        ],
      });

    expect(response.statusCode).toBe(202);
    expect(response.body.data).toEqual({ accepted: 2, transport: "in-process" });

    const produced = pipelineMetrics.getSnapshot().topics[KAFKA_TOPICS.CLICKSTREAM].produced;
    expect(produced).toBe(2);
  });

  test("feeds accepted events into the live funnel", async () => {
    await request(app)
      .post("/api/events")
      .send({ sessionId: "session-2", events: [{ action: "page_view" }, { action: "page_view" }] });

    const funnel = realtimeMetrics.getSnapshot().funnel;
    expect(funnel.find((row) => row.stage === "page_view").events).toBe(2);
  });

  test("rejects a request without a session or an events array", async () => {
    const response = await request(app).post("/api/events").send({ events: "nope" });
    expect(response.statusCode).toBe(400);
  });

  test("caps a batch at 50 events", async () => {
    const events = Array.from({ length: 80 }, () => ({ action: "page_view" }));
    const response = await request(app).post("/api/events").send({ sessionId: "session-3", events });
    expect(response.body.data.accepted).toBe(50);
  });
});

describe("pipeline admin endpoints", () => {
  test.each(["/api/pipeline/status", "/api/pipeline/realtime", "/api/pipeline/insights"])(
    "GET %s requires authentication",
    async (url) => {
      const response = await request(app).get(url);
      expect(response.statusCode).toBe(401);
    }
  );

  test("POST /api/pipeline/simulate requires authentication", async () => {
    const response = await request(app).post("/api/pipeline/simulate").send({ orders: 5 });
    expect(response.statusCode).toBe(401);
  });
});

describe("realtime metrics windows", () => {
  test("aggregates orders, revenue, trending items and funnel stages", () => {
    const now = new Date().toISOString();
    realtimeMetrics.ingestEvent(KAFKA_TOPICS.ORDER_CREATED, {
      occurredAt: now,
      restaurantId: "r1",
      restaurantName: "Dragon Bowl",
      totalAmount: 500,
      items: [{ name: "Hakka Noodles", quantity: 2 }],
    });
    realtimeMetrics.ingestEvent(KAFKA_TOPICS.ORDER_CREATED, {
      occurredAt: now,
      restaurantId: "r1",
      restaurantName: "Dragon Bowl",
      totalAmount: 250.5,
      items: [{ name: "Hakka Noodles", quantity: 1 }, { name: "Spring Roll", quantity: 1 }],
    });
    realtimeMetrics.ingestEvent(KAFKA_TOPICS.ORDER_PAID, { occurredAt: now });

    const snapshot = realtimeMetrics.getSnapshot();

    expect(snapshot.engine).toBe("node-in-process");
    expect(snapshot.totals).toEqual(expect.objectContaining({ orders: 2, revenue: 750.5 }));
    expect(snapshot.series).toHaveLength(30);
    expect(snapshot.series[29].orders).toBe(2);
    expect(snapshot.topRestaurants[0]).toEqual(
      expect.objectContaining({ restaurantName: "Dragon Bowl", orders: 2 })
    );
    expect(snapshot.trendingItems[0]).toEqual({ itemName: "Hakka Noodles", quantity: 3 });
    expect(snapshot.funnel.find((row) => row.stage === "order_placed").events).toBe(2);
    expect(snapshot.funnel.find((row) => row.stage === "payment_completed").events).toBe(1);
  });

  test("a Spark update for the same window replaces the value instead of adding to it", () => {
    const windowStart = new Date().toISOString();
    const record = { metric: "order_window", windowStart, restaurantId: "r1", orders: 3, revenue: 300 };

    realtimeMetrics.ingestSparkRecord(record);
    realtimeMetrics.ingestSparkRecord({ ...record, orders: 5, revenue: 500 });

    expect(realtimeMetrics.getSnapshot().totals).toEqual(
      expect.objectContaining({ orders: 5, revenue: 500 })
    );
  });

  test("ignores records that are not recognised metrics", () => {
    expect(realtimeMetrics.ingestSparkRecord({ metric: "unknown", windowStart: new Date().toISOString() })).toBe(false);
    expect(realtimeMetrics.ingestSparkRecord({ metric: "funnel", windowStart: "not-a-date", stage: "page_view" })).toBe(false);
    expect(realtimeMetrics.getSnapshot().engine).toBe("node-in-process");
  });
});
