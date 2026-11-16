// Runs against a real Kafka broker. Skipped unless KAFKA_INTEGRATION_BROKERS is set:
//
//   KAFKA_INTEGRATION_BROKERS=localhost:9092 npx jest kafka.integration
//
// CI starts a broker as a service container and runs this (see .github/workflows).

process.env.NODE_ENV = "test";

const brokers = process.env.KAFKA_INTEGRATION_BROKERS;
const describeWithKafka = brokers ? describe : describe.skip;

jest.mock("../services/notificationService", () => ({
  pushUserNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/deliveryAssignmentService", () => ({
  autoAssignDeliveryPartner: jest.fn().mockResolvedValue(null),
}));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describeWithKafka("event bus against a real Kafka broker", () => {
  let bus;
  let notifications;
  let KAFKA_TOPICS;

  beforeAll(async () => {
    process.env.KAFKA_ENABLED = "true";
    process.env.KAFKA_BROKERS = brokers;
    process.env.KAFKA_GROUP_ID = `foodex-it-${Date.now()}`;
    process.env.KAFKA_TOPIC_PARTITIONS = "3";

    jest.resetModules();
    KAFKA_TOPICS = require("../constants/kafkaTopics");
    notifications = require("../services/notificationService");
    bus = require("../kafka");
    await bus.initializeKafka();
  }, 60000);

  afterAll(async () => {
    await bus?.shutdownKafka();
  }, 30000);

  test("connects and creates the managed topics with three partitions", async () => {
    const status = await bus.getKafkaStatus();

    expect(status.connected).toBe(true);
    expect(status.topics.map((item) => item.topic).sort()).toEqual(Object.values(KAFKA_TOPICS).sort());
    expect(status.topics.every((item) => item.partitions === 3)).toBe(true);
  });

  test("an order event travels producer -> broker -> consumer group -> handler", async () => {
    // A new consumer group starts at the latest offset, so keep publishing
    // until the group has its partitions and picks an event up.
    const deadline = Date.now() + 45000;
    let published = 0;

    while (Date.now() < deadline && notifications.pushUserNotification.mock.calls.length === 0) {
      const result = await bus.publishEvent(KAFKA_TOPICS.ORDER_PAID, {
        orderId: `it-order-${published}`,
        userId: "it-user",
      });
      expect(result.transport).toBe("kafka");
      published += 1;
      await sleep(1000);
    }

    expect(notifications.pushUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "it-user", type: "payment_success" })
    );
  }, 60000);

  test("the broker reports the produced messages", async () => {
    await sleep(5500); // let the status cache expire
    const status = await bus.getKafkaStatus();
    const paid = status.topics.find((item) => item.topic === KAFKA_TOPICS.ORDER_PAID);

    expect(paid.messages).toBeGreaterThan(0);
  }, 30000);
});
