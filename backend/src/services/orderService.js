const { StatusCodes } = require("http-status-codes");
const crypto = require("crypto");
const env = require("../config/env");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { ORDER_STATUS, PAYMENT_STATUS, DELIVERY_PARTNER_STATUSES, CHECKOUT_METHODS, canTransition } = require("../constants/order");
const ROLES = require("../constants/roles");
const KAFKA_TOPICS = require("../constants/kafkaTopics");
const ApiError = require("../utils/ApiError");
const {
  createRazorpayOrder,
  verifySignature,
  verifyWebhookSignature,
  fetchPaymentMethod,
  describePayment,
} = require("./paymentService");
const User = require("../models/User");

// "+91 98765 43210" -> "9876543210"; anything that is not an Indian mobile number -> undefined.
const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "").replace(/^(?:91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : undefined;
};
const { emitOrderUpdate, emitDeliveryLocation } = require("../sockets/socketManager");
const { publishEvent } = require("../kafka");
const { refreshRestaurantDemand } = require("./demandService");
const pricingService = require("./pricingService");
const metrics = require("../observability/metrics");
const loyaltyService = require("./loyaltyService");
const { smsQueue, pushNotificationQueue, analyticsQueue } = require("../queues");
const { publishOrderStatusUpdate } = require("../graphql/subscriptionBus");


// Publishes the order's current status so downstream consumers (Spark, the data
// lake) can rebuild the full order lifecycle, including actual delivery time.
const publishOrderStatusEvent = async (order) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : null;
  const isDelivered = order.status === ORDER_STATUS.DELIVERED;

  await publishEvent(KAFKA_TOPICS.ORDER_STATUS_CHANGED, {
    orderId: String(order._id),
    userId: String(order.user?._id || order.user),
    restaurantId: String(order.restaurant?._id || order.restaurant),
    status: order.status,
    totalAmount: order.totalAmount,
    deliveryMinutes:
      isDelivered && createdAt ? Number(((Date.now() - createdAt) / 60000).toFixed(1)) : null,
  });
};

const upsertPaymentTransaction = async ({
  order,
  status,
  razorpayOrderId,
  razorpayPaymentId,
  metadata,
  paymentMethod,
}) => {
  try {
    await Payment.findOneAndUpdate(
      { order: order._id },
      {
        user: order.user,
        restaurant: order.restaurant,
        order: order._id,
        provider: "razorpay",
        amount: order.totalAmount,
        currency: "INR",
        status,
        razorpayOrderId: razorpayOrderId || order.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
        ...(status === PAYMENT_STATUS.PAID ? { paidAt: new Date() } : {}),
        ...(paymentMethod ? { method: paymentMethod.method, methodDetails: paymentMethod.details } : {}),
        lastEventAt: new Date(),
        metadata,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (_error) {
    // Payment tracking should not block order flow.
  }
};

const geocodeWithMaptiler = async (deliveryAddress) => {
  if (!env.maptilerApiKey || !deliveryAddress) {
    return null;
  }

  const queryCandidates = [
    [deliveryAddress.line1, deliveryAddress.city, deliveryAddress.state, deliveryAddress.postalCode]
      .filter(Boolean)
      .join(", "),
    [deliveryAddress.postalCode, deliveryAddress.city, deliveryAddress.state]
      .filter(Boolean)
      .join(", "),
    [deliveryAddress.city, deliveryAddress.state]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  if (!queryCandidates.length) {
    return null;
  }

  try {
    for (const query of queryCandidates) {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${env.maptilerApiKey}&limit=1`;
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const center = data?.features?.[0]?.center;
      if (!Array.isArray(center) || center.length < 2) {
        continue;
      }

      return {
        lng: Number(center[0]),
        lat: Number(center[1]),
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
};

const hydrateDeliveryAddressLocation = async (deliveryAddress) => {
  if (!deliveryAddress) {
    return deliveryAddress;
  }

  if (deliveryAddress.location?.lat !== undefined && deliveryAddress.location?.lng !== undefined) {
    return deliveryAddress;
  }

  const geocodedLocation = await geocodeWithMaptiler(deliveryAddress);
  if (!geocodedLocation) {
    return deliveryAddress;
  }

  return {
    ...deliveryAddress,
    location: geocodedLocation,
  };
};

const ensureOrderDeliveryLocation = async (order) => {
  if (!order?.deliveryAddress) {
    return order;
  }

  if (
    order.deliveryAddress.location?.lat !== undefined &&
    order.deliveryAddress.location?.lng !== undefined
  ) {
    return order;
  }

  const hydratedDeliveryAddress = await hydrateDeliveryAddressLocation(order.deliveryAddress);
  if (
    !hydratedDeliveryAddress?.location ||
    hydratedDeliveryAddress.location.lat === undefined ||
    hydratedDeliveryAddress.location.lng === undefined
  ) {
    return order;
  }

  order.deliveryAddress = hydratedDeliveryAddress;
  await order.save();
  return order;
};

const createOrder = async ({ userId, restaurantId, items, deliveryAddress, couponCode, contactPhone }) => {
  const priced = await pricingService.quote({ restaurantId, items, couponCode, userId });

  // The customer saw the coupon as valid in the cart; if it no longer is (expired,
  // already used), refuse rather than silently charge the full price.
  if (priced.coupon && !priced.coupon.valid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, priced.coupon.reason);
  }

  const { restaurant, lines: orderItems, subtotal, taxAmount, deliveryFee, totalAmount } = priced;

  const normalizedDeliveryAddress = await hydrateDeliveryAddressLocation(deliveryAddress);

  const draftOrder = await Order.create({
    user: userId,
    restaurant: restaurantId,
    items: orderItems,
    deliveryAddress: normalizedDeliveryAddress,
    subtotal,
    contactPhone: normalizePhone(contactPhone),
    couponCode: priced.coupon?.code,
    discountAmount: priced.discount,
    taxAmount,
    deliveryFee,
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

  await upsertPaymentTransaction({
    order: draftOrder,
    status: PAYMENT_STATUS.PENDING,
    razorpayOrderId: razorpayOrder.id,
    metadata: { source: "checkout_create" },
  });

  metrics.ordersCreated.inc({ coupon: priced.coupon?.code ? "yes" : "no" });

  // Remember the number for next time (payment prefill), if the profile has none.
  const phone = normalizePhone(contactPhone);
  if (phone) {
    await User.updateOne({ _id: userId, $or: [{ phone: { $exists: false } }, { phone: "" }, { phone: null }] }, { phone });
  }
  metrics.orderValue.observe(totalAmount);

  const populated = await Order.findById(draftOrder._id).populate("restaurant", "name address.location");
  emitOrderUpdate(populated, "Order placed and payment initiated");
  await refreshRestaurantDemand(restaurantId);

  await publishEvent(KAFKA_TOPICS.ORDER_CREATED, {
    orderId: String(populated._id),
    userId: String(userId),
    restaurantId: String(restaurantId),
    restaurantName: restaurant.name,
    city: restaurant.address?.city || normalizedDeliveryAddress?.city || "",
    totalAmount,
    couponCode: priced.coupon?.code || null,
    discountAmount: priced.discount,
    itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    items: orderItems.map((item) => ({
      menuItemId: String(item.menuItem),
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    paymentStatus: PAYMENT_STATUS.PENDING,
  });

  return {
    order: populated,
    payment: {
      keyId: env.razorpayKeyId || "",
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      isMock: razorpayOrder.isMock || false,
    },
  };
};

const verifyOrderPayment = async ({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Razorpay order id does not match this order");
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    const alreadySamePayment =
      order.razorpayPaymentId === razorpayPaymentId &&
      order.razorpayOrderId === razorpayOrderId;

    if (!alreadySamePayment) {
      throw new ApiError(StatusCodes.CONFLICT, "Order payment is already completed");
    }

    return Order.findById(order._id).populate("restaurant", "name address.location").populate("user", "name email");
  }

  const isMock = razorpayOrderId.startsWith("mock_order_");
  const isValid = isMock
    ? true
    : verifySignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      });

  if (!isValid) {
    metrics.paymentsVerified.inc({ outcome: "failed", source: "checkout", method: "unknown" });
    order.paymentStatus = PAYMENT_STATUS.FAILED;
    await order.save();
    await upsertPaymentTransaction({
      order,
      status: PAYMENT_STATUS.FAILED,
      razorpayOrderId,
      razorpayPaymentId,
      metadata: { source: "checkout_verify", reason: "signature_mismatch" },
    });
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment verification failed");
  }

  // Which method was used: from Razorpay for real payments; in mock mode, the
  // method the customer picked (there is no real payment to ask about).
  const method = isMock
    ? {
        method: CHECKOUT_METHODS.includes(paymentMethod) ? paymentMethod : "upi",
        details: { simulated: true },
      }
    : await fetchPaymentMethod(razorpayPaymentId);

  metrics.paymentsVerified.inc({ outcome: "paid", source: "checkout", method: method.method });
  order.paymentMethod = method.method;
  order.paymentDetails = method.details;
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

  await upsertPaymentTransaction({
    order,
    status: PAYMENT_STATUS.PAID,
    razorpayOrderId,
    razorpayPaymentId,
    metadata: { source: "checkout_verify" },
    paymentMethod: method,
  });

  const populated = await Order.findById(order._id).populate("restaurant", "name address.location").populate("user", "name email");
  emitOrderUpdate(populated, "Payment successful");
  await publishOrderStatusUpdate(populated);
  await refreshRestaurantDemand(populated.restaurant?._id || populated.restaurant);

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

  // Delivery partners act only on their own deliveries, and only on the delivery
  // steps; admins can make any move the lifecycle allows.
  if (actorRole === ROLES.DELIVERY) {
    if (String(order.deliveryPartner || "") !== String(actorId)) {
      throw new ApiError(StatusCodes.FORBIDDEN, "This order is not assigned to you");
    }
    if (!DELIVERY_PARTNER_STATUSES.includes(status)) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Delivery partners can only mark orders picked up or delivered");
    }
  }

  if (order.status !== status && !canTransition(order.status, status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Cannot move an order from ${order.status} to ${status}`);
  }

  order.status = status;
  order.trackingEvents.push({
    status,
    note,
    location,
    updatedBy: actorId,
  });

  await order.save();

  // Award loyalty points on completion
  if (status === ORDER_STATUS.DELIVERED) {
    await loyaltyService.addPointsForOrder(order.user, order.totalAmount, new Date());
  }

  const populated = await Order.findById(order._id)
    .populate("restaurant", "name address.location")
    .populate("user", "name email phone") // Eagerly load phone for SMS
    .populate("deliveryPartner", "name phone");

  emitOrderUpdate(populated, note || "Order status changed");
  await publishOrderStatusUpdate(populated);
  await publishOrderStatusEvent(populated);

  // --- Enqueue Notifications and Analytics ---
  analyticsQueue.add({
    event: "order_status_updated",
    data: { orderId, newStatus: status, actorId },
  });

  if (populated.user?.phone) {
    smsQueue.add({
      to: populated.user.phone,
      body: `Foodex Update: Your order #${order.shortId} is now ${status}. ${note || ""}`,
    });
  }

  // We would need to store user device tokens to send push notifications
  // For now, this is a placeholder.
  // if (populated.user?.deviceToken) {
  //   pushNotificationQueue.add({
  //     token: populated.user.deviceToken,
  //     title: `Order #${order.shortId} Update`,
  //     body: `Your order is now ${status}.`,
  //     data: { orderId },
  //   });
  // }
  // --- End Notifications ---

  if (location?.lat !== undefined && location?.lng !== undefined) {
    emitDeliveryLocation({
      orderId: String(populated._id),
      location,
      deliveryPartnerId: populated.deliveryPartner?._id || populated.deliveryPartner,
    });
  }

  await refreshRestaurantDemand(populated.restaurant?._id || populated.restaurant);

  return populated;
};

const assignDeliveryPartner = async ({ orderId, deliveryPartnerId, actorId }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  // As with automatic assignment, the rider marks the order picked up.
  order.deliveryPartner = deliveryPartnerId;

  order.trackingEvents.push({
    status: order.status,
    note: "Delivery partner assigned",
    updatedBy: actorId,
  });

  await order.save();

  const populated = await Order.findById(order._id)
    .populate("restaurant", "name address.location")
    .populate("user", "name email")
    .populate("deliveryPartner", "name phone");

  emitOrderUpdate(populated, "Delivery partner assigned");
  await refreshRestaurantDemand(populated.restaurant?._id || populated.restaurant);

  await publishEvent(KAFKA_TOPICS.DELIVERY_ASSIGNED, {
    orderId: String(populated._id),
    userId: String(populated.user?._id || populated.user),
    restaurantId: String(populated.restaurant?._id || populated.restaurant),
    deliveryPartnerId: String(deliveryPartnerId),
    sourceEvent: "manual_assignment",
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

  const orders = await Order.find(query)
    .populate("restaurant", "name address.location")
    .populate("deliveryPartner", "name phone")
    .sort({ createdAt: -1 });

  await Promise.all(orders.map((order) => ensureOrderDeliveryLocation(order)));
  return orders;
};

const getOrderById = async (orderId, user) => {
  let order = await Order.findById(orderId)
    .populate("restaurant", "name address.location")
    .populate("user", "name email")
    .populate("deliveryPartner", "name phone");

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  const isOwner = String(order.user._id) === String(user.userId);
  const isDeliveryPartner = order.deliveryPartner && String(order.deliveryPartner._id) === String(user.userId);

  if (user.role === "admin" || isOwner || isDeliveryPartner) {
    order = await ensureOrderDeliveryLocation(order);
    return order;
  }

  throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to view this order");
};

// Lets the customer pay for an order whose payment was cancelled or failed.
// Razorpay accepts several attempts against one Razorpay order, so the
// existing one is reused rather than creating a second order.
const getPaymentSession = async ({ orderId, user }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }
  if (String(order.user) !== String(user.userId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to pay for this order");
  }
  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new ApiError(StatusCodes.CONFLICT, "This order is already paid");
  }
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new ApiError(StatusCodes.CONFLICT, `This order is ${order.status} and can no longer be paid`);
  }

  let razorpayOrderId = order.razorpayOrderId;
  let isMock = String(razorpayOrderId || "").startsWith("mock_order_");
  if (!razorpayOrderId) {
    const created = await createRazorpayOrder({
      amount: Math.round(order.totalAmount * 100),
      receipt: `foodex_${order._id}`,
      notes: { orderId: String(order._id), userId: String(order.user) },
    });
    razorpayOrderId = created.id;
    isMock = Boolean(created.isMock);
    order.razorpayOrderId = razorpayOrderId;
    await order.save();
  }

  return {
    order: { _id: String(order._id), shortId: order.shortId, totalAmount: order.totalAmount },
    payment: {
      keyId: env.razorpayKeyId || "",
      razorpayOrderId,
      amount: Math.round(order.totalAmount * 100),
      currency: "INR",
      isMock,
    },
  };
};

const getPaymentDiagnostics = async ({ orderId, user }) => {
  const order = await getOrderById(orderId, user);

  const paymentEvent = [...(order.trackingEvents || [])]
    .reverse()
    .find((event) => typeof event.note === "string" && event.note.toLowerCase().includes("payment confirmed"));

  const paymentFailedEvent = [...(order.trackingEvents || [])]
    .reverse()
    .find((event) => typeof event.note === "string" && event.note.toLowerCase().includes("payment failed"));

  const verificationSource = paymentEvent?.note?.toLowerCase().includes("webhook")
    ? "webhook"
    : paymentEvent
      ? "checkout_verify_api"
      : null;

  const isMockOrder = String(order.razorpayOrderId || "").startsWith("mock_order_");
  const canRetryPayment = [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED].includes(order.paymentStatus);

  let nextAction = "none";
  if (order.paymentStatus === PAYMENT_STATUS.PENDING) {
    nextAction = "complete_payment";
  } else if (order.paymentStatus === PAYMENT_STATUS.FAILED) {
    nextAction = "retry_payment";
  }

  return {
    orderId: String(order._id),
    shortId: order.shortId,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    amount: {
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
      currency: "INR",
    },
    gateway: {
      provider: "razorpay",
      isMockOrder,
      razorpayOrderId: order.razorpayOrderId || null,
      razorpayPaymentId: order.razorpayPaymentId || null,
      signatureStored: Boolean(order.razorpaySignature),
      verificationSource,
      verifiedAt: paymentEvent?.timestamp || null,
      failedAt: paymentFailedEvent?.timestamp || null,
    },
    timeline: (order.trackingEvents || []).map((event) => ({
      status: event.status,
      note: event.note || "",
      timestamp: event.timestamp,
      updatedBy: event.updatedBy || null,
    })),
    canRetryPayment,
    nextAction,
    recommendations: {
      verifyOrderOnBackend: true,
      useWebhookForReconciliation: true,
      retryAllowed: canRetryPayment,
    },
  };
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
      const method = describePayment(entity);
      order.paymentMethod = method.method;
      order.paymentDetails = method.details;
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

      await upsertPaymentTransaction({
        order,
        status: PAYMENT_STATUS.PAID,
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        metadata: { source: "webhook", event },
        paymentMethod: method,
      });

      const populated = await Order.findById(order._id)
        .populate("restaurant", "name address.location")
        .populate("user", "name email")
        .populate("deliveryPartner", "name phone");

      emitOrderUpdate(populated, "Payment confirmed (webhook)");
      await refreshRestaurantDemand(populated.restaurant?._id || populated.restaurant);

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

    await upsertPaymentTransaction({
      order,
      status: PAYMENT_STATUS.FAILED,
      razorpayOrderId: entity.order_id,
      razorpayPaymentId: entity.id,
      metadata: { source: "webhook", event },
    });

    const populated = await Order.findById(order._id)
      .populate("restaurant", "name address.location")
      .populate("user", "name email")
      .populate("deliveryPartner", "name phone");

    emitOrderUpdate(populated, "Payment failed");
    await refreshRestaurantDemand(populated.restaurant?._id || populated.restaurant);
    return { processed: true, event, orderId: String(order._id) };
  }

  return { processed: false, reason: `Unhandled event ${event}` };
};

module.exports = {
  normalizePhone,
  getPaymentSession,
  publishOrderStatusEvent,
  createOrder,
  verifyOrderPayment,
  updateOrderStatus,
  assignDeliveryPartner,
  getOrdersForUser,
  getOrderById,
  getPaymentDiagnostics,
  processRazorpayWebhook,
};
