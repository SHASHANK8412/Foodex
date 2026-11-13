const KAFKA_TOPICS = require("../constants/kafkaTopics");
const { pushUserNotification } = require("../services/notificationService");
const { autoAssignDeliveryPartner } = require("../services/deliveryAssignmentService");

// Domain reactions to events. The same handlers run whether the event arrived
// through a Kafka consumer or through the in-process fallback, so behaviour is
// identical with and without a broker.
const createEventHandlers = ({ publishEvent }) => {
  const assignDelivery = async (event, sourceEvent) => {
    const assignedOrder = await autoAssignDeliveryPartner({
      orderId: event.orderId,
      source: `${sourceEvent}_event`,
    });

    if (assignedOrder?.deliveryPartner) {
      await publishEvent(KAFKA_TOPICS.DELIVERY_ASSIGNED, {
        orderId: event.orderId,
        userId: event.userId,
        restaurantId: event.restaurantId,
        deliveryPartnerId: String(assignedOrder.deliveryPartner._id || assignedOrder.deliveryPartner),
        sourceEvent,
      });
    }
  };

  return {
    [KAFKA_TOPICS.ORDER_CREATED]: async (event) => {
      await pushUserNotification({
        userId: event.userId,
        type: "order_created",
        title: "Order placed",
        message: `Your order #${event.orderId} has been placed successfully`,
        meta: { orderId: event.orderId, eventId: event.eventId },
      });

      await publishEvent(KAFKA_TOPICS.NOTIFICATION_REQUESTED, {
        userId: event.userId,
        orderId: event.orderId,
        type: "order_created",
        message: "Order created notification queued",
      });

      await assignDelivery(event, "order_created");
    },

    [KAFKA_TOPICS.ORDER_PAID]: async (event) => {
      await pushUserNotification({
        userId: event.userId,
        type: "payment_success",
        title: "Payment successful",
        message: `Payment confirmed for order #${event.orderId}`,
        meta: { orderId: event.orderId, eventId: event.eventId },
      });

      await assignDelivery(event, "order_paid");
    },

    [KAFKA_TOPICS.NOTIFICATION_REQUESTED]: async (event) => {
      console.log(`[EVENT] Notification queued: ${event.type} for order ${event.orderId}`);
    },
  };
};

module.exports = { createEventHandlers };
