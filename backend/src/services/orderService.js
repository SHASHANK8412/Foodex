const { StatusCodes } = require("http-status-codes");
const crypto = require("crypto");
const env = require("../config/env");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/order");
const KAFKA_TOPICS = require("../constants/kafkaTopics");
const ApiError = require("../utils/ApiError");
const { createRazorpayOrder, verifySignature, verifyWebhookSignature } = require("./paymentService");
const { emitOrderUpdate } = require("../sockets/socketManager");
const { publishEvent } = require("../kafka");
const { pushUserNotification } = require("./notificationService");

const assertDeliveryPartnerAssigned = (order, deliveryPartnerId) => {
  if (!order.deliveryPartner) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to update this order");
  }

  if (String(order.deliveryPartner) !== String(deliveryPartnerId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to update this order");
  }
};

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

  await publishEvent(KAFKA_TOPICS.ORDER_CREATED, {
    orderId: String(populated._id),
    userId: String(userId),
    restaurantId: String(restaurantId),
    totalAmount,
    paymentStatus: PAYMENT_STATUS.PENDING,
  });

  return {
    order: populated,
    payment: {
      keyId: env.razorpayKeyId,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
  };
};

const verifyOrderPayment = async ({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  const isValid = verifySignature({
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

  await publishEvent(KAFKA_TOPICS.ORDER_PAID, {
    orderId: String(populated._id),
    userId: String(populated.user?._id || populated.user),
    restaurantId: String(populated.restaurant?._id || populated.restaurant),
    totalAmount: populated.totalAmount,
    paymentStatus: PAYMENT_STATUS.PAID,
  });

  return populated;
};

const updateOrderStatus = async ({ orderId, status, actorId, actorRole, note, location }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (actorRole === "delivery") {
    assertDeliveryPartnerAssigned(order, actorId);
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

  await pushUserNotification({
    userId: populated.deliveryPartner?._id || populated.deliveryPartner,
    type: "info",
    title: "New delivery assigned",
    message: `Order ${String(populated._id).slice(-8)} is assigned to you.`,
    meta: {
      orderId: String(populated._id),
    },
  });
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

  if (user.role === "restaurant") {
    const restaurants = await Restaurant.find({ createdBy: user.userId }).select("_id");
    const restaurantIds = restaurants.map((restaurant) => restaurant._id);

    query.restaurant = { $in: restaurantIds };
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

  let isRestaurantOwner = false;
  if (user.role === "restaurant") {
    const restaurant = await Restaurant.findById(order.restaurant?._id || order.restaurant).select("createdBy");
    isRestaurantOwner = Boolean(restaurant && String(restaurant.createdBy) === String(user.userId));
  }

  if (user.role === "admin" || isOwner || isDeliveryPartner || isRestaurantOwner) {
    return order;
  }

  throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to view this order");
};

const processRazorpayWebhook = async ({ rawBody, signature }) => {
  if (!signature) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Missing Razorpay signature header");
  }

  const isSignatureValid = verifyWebhookSignature({ rawBody, signature });
  if (!isSignatureValid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid Razorpay webhook signature");
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event;
  const entity = payload.payload?.payment?.entity;

  if (!entity?.order_id) {
    return { processed: false, reason: "No payment order id in payload" };
  }

  const order = await Order.findOne({ razorpayOrderId: entity.order_id });
  if (!order) {
    return { processed: false, reason: "Order not found for webhook" };
  }

  if (event === "payment.captured" || event === "order.paid") {
    const shouldUpdate =
      order.paymentStatus !== PAYMENT_STATUS.PAID ||
      order.razorpayPaymentId !== entity.id ||
      !order.razorpaySignature;

    if (shouldUpdate) {
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.status = ORDER_STATUS.CONFIRMED;
      order.razorpayPaymentId = entity.id;
      order.razorpaySignature = crypto
        .createHash("sha256")
        .update(`${entity.order_id}|${entity.id}`)
        .digest("hex");
      order.trackingEvents.push({
        status: ORDER_STATUS.CONFIRMED,
        note: "Payment confirmed via webhook",
      });

      await order.save();

      const populated = await Order.findById(order._id)
        .populate("restaurant", "name")
        .populate("user", "name email")
        .populate("deliveryPartner", "name phone");

      emitOrderUpdate(populated, "Payment confirmed (webhook)");

      await publishEvent(KAFKA_TOPICS.ORDER_PAID, {
        orderId: String(populated._id),
        userId: String(populated.user?._id || populated.user),
        restaurantId: String(populated.restaurant?._id || populated.restaurant),
        totalAmount: populated.totalAmount,
        paymentStatus: PAYMENT_STATUS.PAID,
      });
    }

    return { processed: true, event, orderId: String(order._id) };
  }

  if (event === "payment.failed") {
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    order.trackingEvents.push({
      status: order.status,
      note: "Payment failed via webhook",
    });
    await order.save();

    const populated = await Order.findById(order._id)
      .populate("restaurant", "name")
      .populate("user", "name email")
      .populate("deliveryPartner", "name phone");

    emitOrderUpdate(populated, "Payment failed");
    return { processed: true, event, orderId: String(order._id) };
  }

  return { processed: false, reason: `Unhandled event ${event}` };
};

module.exports = {
  createOrder,
  verifyOrderPayment,
  updateOrderStatus,
  assignDeliveryPartner,
  getOrdersForUser,
  getOrderById,
  processRazorpayWebhook,
};
