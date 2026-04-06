const Order = require("../models/Order");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const { ORDER_STATUS } = require("../constants/order");
const { emitOrderUpdate } = require("../sockets/socketManager");

const autoAssignDeliveryPartner = async ({ orderId, source = "kafka" }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  if (order.deliveryPartner) {
    return order;
  }

  const partner = await User.findOne({ role: ROLES.DELIVERY, isActive: true }).sort({ createdAt: 1 });
  if (!partner) {
    return null;
  }

  order.deliveryPartner = partner._id;
  if (order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.PREPARING) {
    order.status = ORDER_STATUS.OUT_FOR_DELIVERY;
  }

  order.trackingEvents.push({
    status: order.status,
    note: `Delivery partner assigned via ${source}`,
    updatedBy: partner._id,
  });

  await order.save();

  const populated = await Order.findById(order._id)
    .populate("restaurant", "name")
    .populate("user", "name email")
    .populate("deliveryPartner", "name phone");

  emitOrderUpdate(populated, "Delivery partner assigned");
  return populated;
};

module.exports = {
  autoAssignDeliveryPartner,
};
