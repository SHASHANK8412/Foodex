const { StatusCodes } = require("http-status-codes");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");

const createRestaurant = async (payload, userId) => {
  return Restaurant.create({
    ...payload,
    createdBy: userId,
    ownerId: payload.ownerId || userId,
  });
};

const listRestaurants = async () => {
  return Restaurant.find({}).sort({ createdAt: -1 });
};

const getRestaurantById = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  const menu = await MenuItem.find({ restaurant: restaurantId, isAvailable: true });
  return { restaurant, menu };
};

const updateRestaurant = async (restaurantId, payload) => {
  const restaurant = await Restaurant.findByIdAndUpdate(restaurantId, payload, {
    new: true,
    runValidators: true,
  });

  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  return restaurant;
};

const createMenuItem = async (restaurantId, payload) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  return MenuItem.create({ ...payload, restaurant: restaurantId });
};

const updateMenuItem = async (menuItemId, payload) => {
  const menuItem = await MenuItem.findByIdAndUpdate(menuItemId, payload, {
    new: true,
    runValidators: true,
  });

  if (!menuItem) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
  }

  return menuItem;
};

module.exports = {
  createRestaurant,
  listRestaurants,
  getRestaurantById,
  updateRestaurant,
  createMenuItem,
  updateMenuItem,
};
