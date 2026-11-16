const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const restaurantService = require("../services/restaurantService");
const MenuItem = require("../models/MenuItem");
const { estimateOrderEta } = require("../services/analyticsService");

// Every restaurant carries the same delivery estimate checkout and the ordering
// agent use (kitchen wait plus travel), so the number never differs between screens.
const withDeliveryEstimate = (restaurant) => {
  const plain = typeof restaurant.toJSON === "function" ? restaurant.toJSON() : restaurant;
  return { ...plain, deliveryMinutes: estimateOrderEta({ restaurant: plain, itemCount: 2 }).minutes };
};

const createRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await restaurantService.createRestaurant(req.body, req.user.userId);
  res.status(StatusCodes.CREATED).json({ success: true, data: restaurant });
});

const listRestaurants = asyncHandler(async (_req, res) => {
  const restaurants = await restaurantService.listRestaurants();
  const dishes = await MenuItem.aggregate([
    { $match: { restaurant: { $in: restaurants.map((restaurant) => restaurant._id) }, isAvailable: true } },
    { $group: { _id: "$restaurant", names: { $push: "$name" }, tags: { $push: "$tags" } } },
  ]);
  const dishesById = new Map(dishes.map((row) => [String(row._id), row]));

  const data = restaurants.map((restaurant) => {
    const row = dishesById.get(String(restaurant._id));
    return {
      ...withDeliveryEstimate(restaurant),
      dishNames: row?.names || [],
      dishTags: [...new Set((row?.tags || []).flat().filter(Boolean))],
    };
  });
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getRestaurant = asyncHandler(async (req, res) => {
  const data = await restaurantService.getRestaurantById(req.params.restaurantId);
  res.status(StatusCodes.OK).json({ success: true, data: { ...data, restaurant: withDeliveryEstimate(data.restaurant) } });
});

const updateRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await restaurantService.updateRestaurant(req.params.restaurantId, req.body);
  res.status(StatusCodes.OK).json({ success: true, data: restaurant });
});

const createMenuItem = asyncHandler(async (req, res) => {
  const menuItem = await restaurantService.createMenuItem(req.params.restaurantId, req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: menuItem });
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const menuItem = await restaurantService.updateMenuItem(req.params.menuItemId, req.body);
  res.status(StatusCodes.OK).json({ success: true, data: menuItem });
});

module.exports = {
  createRestaurant,
  listRestaurants,
  getRestaurant,
  updateRestaurant,
  createMenuItem,
  updateMenuItem,
};
