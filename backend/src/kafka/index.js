const { Kafka, logLevel } = require("kafkajs");
const env = require("../config/env");
const KAFKA_TOPICS = require("../constants/kafkaTopics");
const { pushUserNotification } = require("../services/notificationService");
const { autoAssignDeliveryPartner } = require("../services/deliveryAssignmentService");

let producer = null;
let consumer = null;
let kafkaEnabled = false;

const parseBrokers = () => {
  return env.kafkaBrokers
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
};

const initializeKafka = async () => {
  kafkaEnabled = env.kafkaEnabled;
  if (!kafkaEnabled) {
    console.log("Kafka disabled: using direct processing fallback");
    return;
  }

  const brokers = parseBrokers();
  if (!brokers.length) {
    console.log("Kafka disabled: no brokers configured");
    kafkaEnabled = false;
    return;
  }

  const kafka = new Kafka({
    clientId: env.kafkaClientId,
    brokers,
    logLevel: logLevel.NOTHING,
  });

  producer = kafka.producer();
  consumer = kafka.consumer({ groupId: env.kafkaGroupId });

  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({ topic: KAFKA_TOPICS.ORDER_CREATED, fromBeginning: false });
  await consumer.subscribe({ topic: KAFKA_TOPICS.ORDER_PAID, fromBeginning: false });
  await consumer.subscribe({ topic: KAFKA_TOPICS.NOTIFICATION_REQUESTED, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) {
        return;
      }

      const payload = JSON.parse(message.value.toString());

      if (topic === KAFKA_TOPICS.ORDER_CREATED) {
        await pushUserNotification({
          userId: payload.userId,
          type: "order_created",
          title: "Order placed",
          message: `Your order #${payload.orderId} has been placed successfully`,
          meta: payload,
        });

        await publishEvent(KAFKA_TOPICS.NOTIFICATION_REQUESTED, {
          userId: payload.userId,
          type: "order_created",
          orderId: payload.orderId,
          message: "Order created notification queued",
        });

        const assignedOrder = await autoAssignDeliveryPartner({
          orderId: payload.orderId,
          source: "order_created_event",
        });

        if (assignedOrder?.deliveryPartner) {
          await publishEvent(KAFKA_TOPICS.DELIVERY_ASSIGNED, {
            orderId: payload.orderId,
            deliveryPartnerId: String(assignedOrder.deliveryPartner._id || assignedOrder.deliveryPartner),
            sourceEvent: "order_created",
          });
        }
      }

      if (topic === KAFKA_TOPICS.ORDER_PAID) {
        await pushUserNotification({
          userId: payload.userId,
          type: "payment_success",
          title: "Payment successful",
          message: `Payment confirmed for order #${payload.orderId}`,
          meta: payload,
        });

        const assignedOrder = await autoAssignDeliveryPartner({
          orderId: payload.orderId,
          source: "order_paid_event",
        });

        if (assignedOrder?.deliveryPartner) {
          await publishEvent(KAFKA_TOPICS.DELIVERY_ASSIGNED, {
            orderId: payload.orderId,
            deliveryPartnerId: String(assignedOrder.deliveryPartner._id || assignedOrder.deliveryPartner),
            sourceEvent: "order_paid",
          });
        }
      }

      if (topic === KAFKA_TOPICS.NOTIFICATION_REQUESTED) {
        console.log(`[KAFKA] Notification queued: ${payload.type} for order ${payload.orderId}`);
      }
    },
  });

  console.log("Kafka producer and consumer connected");
};

const publishEvent = async (topic, payload) => {
  if (!kafkaEnabled || !producer) {
    return;
  }

  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify({
          ...payload,
          emittedAt: new Date().toISOString(),
        }),
      },
    ],
  });
};

const shutdownKafka = async () => {
  const disconnects = [];

  if (consumer) {
    disconnects.push(consumer.disconnect());
  }

  if (producer) {
    disconnects.push(producer.disconnect());
  }

  await Promise.allSettled(disconnects);
};

module.exports = {
  initializeKafka,
  publishEvent,
  shutdownKafka,
};
