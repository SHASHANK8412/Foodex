const { PubSub } = require("graphql-subscriptions");

const pubsub = new PubSub();
const ORDER_STATUS_UPDATED = "ORDER_STATUS_UPDATED";

const publishOrderStatusUpdate = async (payload) => {
  await pubsub.publish(ORDER_STATUS_UPDATED, {
    orderStatusUpdated: payload,
  });
};

module.exports = {
  pubsub,
  ORDER_STATUS_UPDATED,
  publishOrderStatusUpdate,
};
