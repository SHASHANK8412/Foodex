const Order = require("../models/Order");
const User = require("../models/User");
const ROLES = require("../constants/roles");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/order");

const ACTIVE_STATUSES = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING, ORDER_STATUS.OUT_FOR_DELIVERY];

// The rider with the fewest active deliveries, preferring riders who have marked
// themselves available. Ties go to whoever has been a rider longest.
const pickLeastBusyPartner = async () => {
  const partners = await User.find({ role: ROLES.DELIVERY, isActive: true })
    .select("deliveryPartnerProfile createdAt")
    .lean();
  if (!partners.length) {
    return null;
  }

  const load = await Order.aggregate([
    { $match: { deliveryPartner: { $in: partners.map((partner) => partner._id) }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: "$deliveryPartner", active: { $sum: 1 } } },
  ]);
  const activeById = new Map(load.map((row) => [String(row._id), row.active]));

  const available = partners.filter((partner) => partner.deliveryPartnerProfile?.isAvailable);
  const pool = available.length ? available : partners;

  return pool.sort(
    (a, b) =>
      (activeById.get(String(a._id)) || 0) - (activeById.get(String(b._id)) || 0) ||
      new Date(a.createdAt) - new Date(b.createdAt)
  )[0];
};
const { emitOrderUpdate } = require("../sockets/socketManager");

const autoAssignDeliveryPartner = async ({ orderId, source = "kafka" }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  if (order.deliveryPartner) {
    return order;
  }

  // Only paid orders get a rider; an unpaid order may never be fulfilled.
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    return null;
  }

  const partner = await pickLeastBusyPartner();
  if (!partner) {
    return null;
  }

  // The status stays as it is: the rider marks the order picked up from their dashboard.
  order.deliveryPartner = partner._id;

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
  pickLeastBusyPartner,
  autoAssignDeliveryPartner,
};
