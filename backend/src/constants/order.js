const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
};

// The order lifecycle. Every status change, by any role, must follow these edges.
const ORDER_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

// What a delivery partner may set, and only on orders assigned to them.
const DELIVERY_PARTNER_STATUSES = [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED];

const canTransition = (from, to) => (ORDER_TRANSITIONS[from] || []).includes(to);

module.exports = {
  ORDER_STATUS,
  PAYMENT_STATUS,
  ORDER_TRANSITIONS,
  DELIVERY_PARTNER_STATUSES,
  canTransition,
};
