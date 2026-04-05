const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const restaurantService = require("../services/restaurantService");

const createRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await restaurantService.createRestaurant(req.body, req.user.userId);
  res.status(StatusCodes.CREATED).json({ success: true, data: restaurant });
});

const listRestaurants = asyncHandler(async (_req, res) => {
  const restaurants = await restaurantService.listRestaurants();
  res.status(StatusCodes.OK).json({ success: true, data: restaurants });
});

const getRestaurant = asyncHandler(async (req, res) => {
  const data = await restaurantService.getRestaurantById(req.params.restaurantId);
  res.status(StatusCodes.OK).json({ success: true, data });
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
