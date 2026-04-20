const { StatusCodes } = require("http-status-codes");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");

const assertRestaurantOwner = (restaurant, actorId) => {
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  if (String(restaurant.createdBy) !== String(actorId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to modify this restaurant");
  }
};

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

const listRestaurantsForOwner = async (ownerId) => {
  return Restaurant.find({ createdBy: ownerId }).sort({ createdAt: -1 });
};

const getRestaurantById = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  const menu = await MenuItem.find({ restaurant: restaurantId, isAvailable: true });
  return { restaurant, menu };
};

const updateRestaurant = async (restaurantId, payload, actor) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  if (actor?.role === "restaurant") {
    assertRestaurantOwner(restaurant, actor.userId);
  }

  Object.assign(restaurant, payload);
  await restaurant.save();
  return restaurant;
};

const createMenuItem = async (restaurantId, payload, actor) => {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  if (actor?.role === "restaurant") {
    assertRestaurantOwner(restaurant, actor.userId);
  }

  return MenuItem.create({ ...payload, restaurant: restaurantId });
};

const updateMenuItem = async (menuItemId, payload, actor) => {
  const menuItem = await MenuItem.findById(menuItemId);

  if (!menuItem) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
  }

  if (actor?.role === "restaurant") {
    const restaurant = await Restaurant.findById(menuItem.restaurant);
    assertRestaurantOwner(restaurant, actor.userId);
  }

  Object.assign(menuItem, payload);
  await menuItem.save();
  return menuItem;
};

module.exports = {
  createRestaurant,
  listRestaurants,
  listRestaurantsForOwner,
  getRestaurantById,
  updateRestaurant,
  createMenuItem,
  updateMenuItem,
};
