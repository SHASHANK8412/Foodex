const { StatusCodes } = require("http-status-codes");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const ApiError = require("../utils/ApiError");
const { ORDER_STATUS } = require("../constants/order");
const { emitOrderUpdate } = require("../sockets/socketManager");
const { publishOrderStatusUpdate } = require("../graphql/subscriptionBus");
const { ensureInvoiceForOrder } = require("./invoiceService");

const normalizeOwnerStatus = (status) => {
  if (status === "accepted") {
    return ORDER_STATUS.CONFIRMED;
  }
  if (status === "rejected") {
    return ORDER_STATUS.CANCELLED;
  }
  return status;
};

const allowedTransitions = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

const getOwnerRestaurants = async (ownerId) => {
  return Restaurant.find({ ownerId }).sort({ createdAt: -1 });
};

const getOwnerDashboard = async (ownerId) => {
  const restaurants = await Restaurant.find({ ownerId }).select("_id name");
  const restaurantIds = restaurants.map((r) => r._id);

  const [ordersTodayAgg, pendingOrders, revenueAgg, topDishesAgg] = await Promise.all([
    Order.countDocuments({
      restaurant: { $in: restaurantIds },
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    Order.countDocuments({
      restaurant: { $in: restaurantIds },
      status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING] },
    }),
    Order.aggregate([
      { $match: { restaurant: { $in: restaurantIds }, status: ORDER_STATUS.DELIVERED } },
      { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate([
      { $match: { restaurant: { $in: restaurantIds }, status: ORDER_STATUS.DELIVERED } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", qty: { $sum: "$items.quantity" } } },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return {
    restaurants,
    kpis: {
      ordersToday: ordersTodayAgg,
      pendingOrders,
      revenue: revenueAgg[0]?.revenue || 0,
    },
    topDishes: topDishesAgg,
  };
};

const createMenuItemForOwner = async ({ ownerId, restaurantId, payload }) => {
  const restaurant = await Restaurant.findOne({ _id: restaurantId, ownerId });
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found for owner");
  }

  return MenuItem.create({ ...payload, restaurant: restaurantId });
};

const updateMenuItemForOwner = async ({ ownerId, menuItemId, payload }) => {
  const menuItem = await MenuItem.findById(menuItemId).populate("restaurant", "ownerId");
  if (!menuItem) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
  }

  if (String(menuItem.restaurant?.ownerId) !== String(ownerId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden");
  }

  Object.assign(menuItem, payload);
  await menuItem.save();
  return menuItem;
};

const deleteMenuItemForOwner = async ({ ownerId, menuItemId }) => {
  const menuItem = await MenuItem.findById(menuItemId).populate("restaurant", "ownerId");
  if (!menuItem) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
  }

  if (String(menuItem.restaurant?.ownerId) !== String(ownerId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden");
  }

  await menuItem.deleteOne();
};

const updateRestaurantPromotions = async ({ ownerId, restaurantId, promotions }) => {
  const restaurant = await Restaurant.findOneAndUpdate(
    { _id: restaurantId, ownerId },
    { promotions },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  return restaurant;
};

const setFeaturedItems = async ({ ownerId, restaurantId, itemIds = [] }) => {
  const restaurant = await Restaurant.findOne({ _id: restaurantId, ownerId });
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  await MenuItem.updateMany({ restaurant: restaurantId }, { featured: false });
  await MenuItem.updateMany({ restaurant: restaurantId, _id: { $in: itemIds } }, { featured: true });

  return MenuItem.find({ restaurant: restaurantId, featured: true });
};

const getOwnerOrders = async ({ ownerId, status, search }) => {
  const restaurants = await Restaurant.find({ ownerId }).select("_id");
  const restaurantIds = restaurants.map((restaurant) => restaurant._id);

  const query = { restaurant: { $in: restaurantIds } };

  if (status) {
    query.status = normalizeOwnerStatus(status);
  }

  if (search) {
    query.$or = [
      { shortId: { $regex: search, $options: "i" } },
      { "deliveryAddress.line1": { $regex: search, $options: "i" } },
      { "deliveryAddress.city": { $regex: search, $options: "i" } },
    ];
  }

  return Order.find(query)
    .populate("user", "name email phone")
    .populate("restaurant", "name")
    .populate("deliveryPartner", "name phone")
    .sort({ createdAt: -1 });
};

const updateOwnerOrderStatus = async ({ ownerId, orderId, status, note }) => {
  const normalizedStatus = normalizeOwnerStatus(status);

  if (!Object.values(ORDER_STATUS).includes(normalizedStatus)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid order status");
  }

  const order = await Order.findById(orderId).populate("restaurant", "ownerId name address.location");
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (String(order.restaurant?.ownerId) !== String(ownerId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden");
  }

  const isAllowed = (allowedTransitions[order.status] || []).includes(normalizedStatus);
  if (!isAllowed) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Invalid status transition from ${order.status} to ${normalizedStatus}`
    );
  }

  order.status = normalizedStatus;
  order.trackingEvents.push({
    status: normalizedStatus,
    note: note || `Order moved to ${normalizedStatus}`,
    updatedBy: ownerId,
  });
  await order.save();

  if (normalizedStatus === ORDER_STATUS.CONFIRMED) {
    await ensureInvoiceForOrder(order._id);
  }

  const updated = await Order.findById(order._id)
    .populate("restaurant", "name address.location")
    .populate("user", "name email phone")
    .populate("deliveryPartner", "name phone");

  emitOrderUpdate(updated, note || "Restaurant updated order status");
  await publishOrderStatusUpdate(updated);

  return updated;
};

const getOwnerInvoiceByOrder = async ({ ownerId, orderId }) => {
  const order = await Order.findById(orderId).populate("restaurant", "ownerId");
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (String(order.restaurant?.ownerId) !== String(ownerId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden");
  }

  const invoice = await Invoice.findOne({ order: orderId });
  if (!invoice) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Invoice not found for this order");
  }

  return invoice;
};

module.exports = {
  getOwnerRestaurants,
  getOwnerDashboard,
  createMenuItemForOwner,
  updateMenuItemForOwner,
  deleteMenuItemForOwner,
  updateRestaurantPromotions,
  setFeaturedItems,
  getOwnerOrders,
  updateOwnerOrderStatus,
  getOwnerInvoiceByOrder,
};
