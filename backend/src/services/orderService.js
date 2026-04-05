const { StatusCodes } = require("http-status-codes");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/order");
const ApiError = require("../utils/ApiError");
const { createRazorpayOrder, verifySignature } = require("./paymentService");
const { emitOrderUpdate } = require("../sockets/socketManager");

const TAX_RATE = 0.05;
const DELIVERY_FEE = 40;

const createOrder = async ({ userId, restaurantId, items, deliveryAddress }) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant || !restaurant.isOpen) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Restaurant unavailable");
  }

  const ids = items.map((item) => item.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: ids }, restaurant: restaurantId, isAvailable: true });

  if (menuItems.length !== items.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Some menu items are unavailable");
  }

  const menuMap = new Map(menuItems.map((item) => [item._id.toString(), item]));

  const orderItems = items.map((item) => {
    const menuItem = menuMap.get(item.menuItemId);
    return {
      menuItem: menuItem._id,
      name: menuItem.name,
      quantity: item.quantity,
      price: menuItem.price,
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount + DELIVERY_FEE).toFixed(2));

  const draftOrder = await Order.create({
    user: userId,
    restaurant: restaurantId,
    items: orderItems,
    deliveryAddress,
    subtotal,
    taxAmount,
    deliveryFee: DELIVERY_FEE,
    totalAmount,
    trackingEvents: [
      {
        status: ORDER_STATUS.PENDING,
        note: "Order placed",
        updatedBy: userId,
      },
    ],
  });

  const razorpayOrder = await createRazorpayOrder({
    amount: Math.round(totalAmount * 100),
    receipt: `foodex_${draftOrder._id}`,
    notes: {
      orderId: String(draftOrder._id),
      userId: String(userId),
    },
  });

  draftOrder.razorpayOrderId = razorpayOrder.id;
  await draftOrder.save();

  const populated = await Order.findById(draftOrder._id).populate("restaurant", "name");
  emitOrderUpdate(populated, "Order placed and payment initiated");

  return {
    order: populated,
    payment: {
      keyId: process.env.RAZORPAY_KEY_ID || "",
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      isMock: razorpayOrder.isMock || false,
    },
  };
};

const verifyOrderPayment = async ({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  const isValid = razorpayOrderId.startsWith("mock_order_")
    ? true
    : verifySignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      });

  if (!isValid) {
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    await order.save();
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment verification failed");
  }

  order.paymentStatus = PAYMENT_STATUS.PAID;
  order.status = ORDER_STATUS.CONFIRMED;
  order.razorpayOrderId = razorpayOrderId;
  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;
  order.trackingEvents.push({
    status: ORDER_STATUS.CONFIRMED,
    note: "Payment confirmed",
  });

  await order.save();

  const populated = await Order.findById(order._id).populate("restaurant", "name").populate("user", "name email");
  emitOrderUpdate(populated, "Payment successful");
  return populated;
};

const updateOrderStatus = async ({ orderId, status, actorId, note, location }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  order.status = status;
  order.trackingEvents.push({
    status,
    note,
    location,
    updatedBy: actorId,
  });

  await order.save();

  const populated = await Order.findById(order._id)
    .populate("restaurant", "name")
    .populate("user", "name email")
    .populate("deliveryPartner", "name phone");

  emitOrderUpdate(populated, note || "Order status changed");
  return populated;
};

const assignDeliveryPartner = async ({ orderId, deliveryPartnerId, actorId }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  order.deliveryPartner = deliveryPartnerId;
  if (order.status === ORDER_STATUS.CONFIRMED || order.status === ORDER_STATUS.PREPARING) {
    order.status = ORDER_STATUS.OUT_FOR_DELIVERY;
  }

  order.trackingEvents.push({
    status: order.status,
    note: "Delivery partner assigned",
    updatedBy: actorId,
  });

  await order.save();

  const populated = await Order.findById(order._id)
    .populate("restaurant", "name")
    .populate("user", "name email")
    .populate("deliveryPartner", "name phone");

  emitOrderUpdate(populated, "Delivery partner assigned");
  return populated;
};

const getOrdersForUser = async (user) => {
  const query = {};

  if (user.role === "user") {
    query.user = user.userId;
  }

  if (user.role === "delivery") {
    query.deliveryPartner = user.userId;
  }

  return Order.find(query)
    .populate("restaurant", "name")
    .populate("deliveryPartner", "name phone")
    .sort({ createdAt: -1 });
};

const getOrderById = async (orderId, user) => {
  const order = await Order.findById(orderId)
    .populate("restaurant", "name")
    .populate("user", "name email")
    .populate("deliveryPartner", "name phone");

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  const isOwner = String(order.user._id) === String(user.userId);
  const isDeliveryPartner = order.deliveryPartner && String(order.deliveryPartner._id) === String(user.userId);

  if (user.role === "admin" || isOwner || isDeliveryPartner) {
    return order;
  }

  throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to view this order");
};

module.exports = {
  createOrder,
  verifyOrderPayment,
  updateOrderStatus,
  assignDeliveryPartner,
  getOrdersForUser,
  getOrderById,
};
