process.env.NODE_ENV = "test";

const KAFKA_TOPICS = require("../constants/kafkaTopics");

jest.mock("../services/notificationService", () => ({
  pushUserNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/deliveryAssignmentService", () => ({
  autoAssignDeliveryPartner: jest.fn().mockResolvedValue(null),
}));

// A stand-in for the kafkajs client that records what the event bus does with it.
const mockKafka = {
  sent: [],
  createdTopics: [],
  consumers: {},
  failSend: false,
};

jest.mock("kafkajs", () => ({
  logLevel: { NOTHING: 0 },
  CompressionTypes: { GZIP: 1 },
  Kafka: jest.fn().mockImplementation(() => ({
    admin: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      createTopics: jest.fn(async ({ topics }) => {
        mockKafka.createdTopics.push(...topics);
        return true;
      }),
      fetchOffsets: jest.fn().mockResolvedValue([]),
      fetchTopicOffsets: jest.fn().mockResolvedValue([
        { partition: 0, offset: "7", high: "7", low: "0" },
        { partition: 1, offset: "3", high: "3", low: "0" },
      ]),
    }),
    producer: () => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(async (record) => {
        if (mockKafka.failSend) {
          throw new Error("broker unavailable");
        }
        mockKafka.sent.push(record);
      }),
    }),
    consumer: ({ groupId }) => {
      const consumer = {
        topics: [],
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn(async ({ topic }) => {
          consumer.topics.push(topic);
        }),
        run: jest.fn(async ({ eachMessage }) => {
          consumer.eachMessage = eachMessage;
        }),
      };
      mockKafka.consumers[groupId] = consumer;
      return consumer;
    },
  })),
}));

const loadBus = ({ kafkaEnabled }) => {
  jest.resetModules();
  process.env.KAFKA_ENABLED = kafkaEnabled ? "true" : "false";
  process.env.KAFKA_GROUP_ID = "test-group";
  process.env.KAFKA_TOPIC_PARTITIONS = "3";
  mockKafka.sent = [];
  mockKafka.createdTopics = [];
  mockKafka.consumers = {};
  mockKafka.failSend = false;

  return {
    bus: require("../kafka"),
    metrics: require("../kafka/pipelineMetrics"),
    realtime: require("../services/realtimeMetricsService"),
    notifications: require("../services/notificationService"),
    delivery: require("../services/deliveryAssignmentService"),
  };
};

const message = (value) => ({ value: Buffer.from(value), offset: "42" });

describe("event bus without a broker (in-process transport)", () => {
  test("dispatches order events to the same handlers a Kafka consumer would run", async () => {
    const { bus, notifications, delivery } = loadBus({ kafkaEnabled: false });
    await bus.initializeKafka();

    const result = await bus.publishEvent(KAFKA_TOPICS.ORDER_CREATED, { orderId: "o1", userId: "u1" });

    expect(result.transport).toBe("in-process");
    expect(notifications.pushUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", type: "order_created" })
    );
    // Riders are assigned on payment, not on creation.
    expect(delivery.autoAssignDeliveryPartner).not.toHaveBeenCalled();

    await bus.publishEvent(KAFKA_TOPICS.ORDER_PAID, { orderId: "o1", userId: "u1" });
    expect(delivery.autoAssignDeliveryPartner).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o1" })
    );
  });

  test("wraps payloads in a versioned envelope with a unique event id", async () => {
    const { bus } = loadBus({ kafkaEnabled: false });
    const first = await bus.publishEvent(KAFKA_TOPICS.CLICKSTREAM, { sessionId: "s1", action: "page_view" });
    const second = await bus.publishEvent(KAFKA_TOPICS.CLICKSTREAM, { sessionId: "s1", action: "page_view" });

    expect(first.eventIds[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.eventIds[0]).not.toBe(second.eventIds[0]);
  });

  test("handles a redelivered event only once", async () => {
    const { bus, notifications, metrics } = loadBus({ kafkaEnabled: false });
    const payload = { eventId: "evt-1", orderId: "o1", userId: "u1" };

    await bus.publishEvent(KAFKA_TOPICS.ORDER_PAID, payload);
    await bus.publishEvent(KAFKA_TOPICS.ORDER_PAID, payload);

    expect(notifications.pushUserNotification).toHaveBeenCalledTimes(1);
    expect(metrics.getSnapshot().topics[KAFKA_TOPICS.ORDER_PAID].duplicatesSkipped).toBe(1);
  });

  test("never runs side effects for synthetic (simulated) events", async () => {
    const { bus, notifications, delivery } = loadBus({ kafkaEnabled: false });

    await bus.publishEvent(KAFKA_TOPICS.ORDER_CREATED, { orderId: "o1", userId: "u1", synthetic: true });

    expect(notifications.pushUserNotification).not.toHaveBeenCalled();
    expect(delivery.autoAssignDeliveryPartner).not.toHaveBeenCalled();
  });

  test("retries a failing handler, then dead-letters without throwing", async () => {
    const { bus, notifications, metrics } = loadBus({ kafkaEnabled: false });
    notifications.pushUserNotification.mockRejectedValue(new Error("socket down"));

    await expect(
      bus.publishEvent(KAFKA_TOPICS.ORDER_PAID, { orderId: "o1", userId: "u1" })
    ).resolves.toEqual(expect.objectContaining({ count: 1 }));

    const stats = metrics.getSnapshot().topics[KAFKA_TOPICS.ORDER_PAID];
    expect(notifications.pushUserNotification).toHaveBeenCalledTimes(3);
    expect(stats.failed).toBe(1);
    expect(stats.deadLettered).toBe(1);
  });
});

describe("event bus with Kafka enabled", () => {
  test("creates every managed topic with the configured partition count", async () => {
    const { bus } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();

    expect(mockKafka.createdTopics.map((item) => item.topic).sort()).toEqual(
      Object.values(KAFKA_TOPICS).sort()
    );
    expect(mockKafka.createdTopics.every((item) => item.numPartitions === 3)).toBe(true);
  });

  test("produces keyed, fully acknowledged messages and leaves handling to the consumer", async () => {
    const { bus, notifications } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();

    const result = await bus.publishEvent(KAFKA_TOPICS.ORDER_CREATED, { orderId: "order-9", userId: "u1" });

    expect(result.transport).toBe("kafka");
    expect(mockKafka.sent).toHaveLength(1);
    expect(mockKafka.sent[0].topic).toBe(KAFKA_TOPICS.ORDER_CREATED);
    expect(mockKafka.sent[0].acks).toBe(-1);
    expect(mockKafka.sent[0].messages[0].key).toBe("order-9");
    expect(JSON.parse(mockKafka.sent[0].messages[0].value)).toEqual(
      expect.objectContaining({ orderId: "order-9", eventType: KAFKA_TOPICS.ORDER_CREATED, schemaVersion: 1 })
    );
    expect(notifications.pushUserNotification).not.toHaveBeenCalled();
  });

  test("consumer group handles order events and subscribes to handled topics only", async () => {
    const { bus, notifications } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();
    const consumer = mockKafka.consumers["test-group"];

    expect(consumer.topics.sort()).toEqual(
      [KAFKA_TOPICS.NOTIFICATION_REQUESTED, KAFKA_TOPICS.ORDER_CREATED, KAFKA_TOPICS.ORDER_PAID].sort()
    );

    await consumer.eachMessage({
      topic: KAFKA_TOPICS.ORDER_PAID,
      partition: 1,
      message: message(JSON.stringify({ eventId: "e1", orderId: "o1", userId: "u1" })),
    });

    expect(notifications.pushUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "payment_success" })
    );
  });

  test("parks an unparseable message on the dead-letter topic instead of crashing", async () => {
    const { bus } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();

    await mockKafka.consumers["test-group"].eachMessage({
      topic: KAFKA_TOPICS.ORDER_CREATED,
      partition: 0,
      message: message("{not json"),
    });

    const deadLetters = mockKafka.sent.filter((record) => record.topic === KAFKA_TOPICS.DEAD_LETTER);
    expect(deadLetters).toHaveLength(1);
    expect(JSON.parse(deadLetters[0].messages[0].value)).toEqual(
      expect.objectContaining({ originalTopic: KAFKA_TOPICS.ORDER_CREATED, reason: "invalid_json", offset: "42" })
    );
  });

  test("falls back to in-process handling when a send fails", async () => {
    const { bus, notifications } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();
    mockKafka.failSend = true;

    const result = await bus.publishEvent(KAFKA_TOPICS.ORDER_PAID, { orderId: "o1", userId: "u1" });

    expect(result.transport).toBe("in-process");
    expect(notifications.pushUserNotification).toHaveBeenCalledTimes(1);
  });

  test("feeds Spark's windowed metrics from the realtime topic into the dashboard store", async () => {
    const { bus, realtime } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();
    const consumer = mockKafka.consumers["test-group-realtime"];

    expect(consumer.topics).toEqual([KAFKA_TOPICS.ANALYTICS_REALTIME]);

    await consumer.eachMessage({
      topic: KAFKA_TOPICS.ANALYTICS_REALTIME,
      message: message(
        JSON.stringify({
          metric: "order_window",
          windowStart: new Date().toISOString(),
          restaurantId: "r1",
          restaurantName: "Urban Spice Kitchen",
          orders: 4,
          revenue: 1200,
        })
      ),
    });

    const snapshot = realtime.getSnapshot();
    expect(snapshot.engine).toBe("spark-structured-streaming");
    expect(snapshot.totals.orders).toBe(4);
    expect(snapshot.topRestaurants[0].restaurantName).toBe("Urban Spice Kitchen");
  });

  test("reports per-topic partitions and retained messages from the broker", async () => {
    const { bus } = loadBus({ kafkaEnabled: true });
    await bus.initializeKafka();

    const status = await bus.getKafkaStatus();

    expect(status.connected).toBe(true);
    expect(status.transport).toBe("kafka");
    expect(status.topics).toHaveLength(Object.values(KAFKA_TOPICS).length);
    expect(status.topics[0]).toEqual(expect.objectContaining({ partitions: 2, messages: 10 }));
  });
});
