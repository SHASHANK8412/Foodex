const { StatusCodes } = require("http-status-codes");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const { ORDER_STATUS } = require("../constants/order");

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

module.exports = {
  getOwnerRestaurants,
  getOwnerDashboard,
  createMenuItemForOwner,
  updateMenuItemForOwner,
  deleteMenuItemForOwner,
  updateRestaurantPromotions,
  setFeaturedItems,
};
