// Every topic the platform produces to or consumes from.
// Domain events are produced by the Express API; ANALYTICS_REALTIME is produced
// by the Spark Structured Streaming job and consumed back by the API.
const KAFKA_TOPICS = {
  ORDER_CREATED: "foodex.order.created",
  ORDER_PAID: "foodex.order.paid",
  ORDER_STATUS_CHANGED: "foodex.order.status",
  DELIVERY_ASSIGNED: "foodex.delivery.assigned",
  NOTIFICATION_REQUESTED: "foodex.notification.requested",
  CLICKSTREAM: "foodex.clickstream",
  ANALYTICS_REALTIME: "foodex.analytics.realtime",
  DEAD_LETTER: "foodex.dlq",
};

module.exports = KAFKA_TOPICS;
