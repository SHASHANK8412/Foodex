const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const ApiError = require("../utils/ApiError");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Restaurant = require("../models/Restaurant");
const { ORDER_STATUS } = require("../constants/order");

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const updateRestaurantRatings = async (restaurantId) => {
  const id = toObjectId(restaurantId);

  const [agg] = await Review.aggregate([
    { $match: { restaurant: id } },
    {
      $group: {
        _id: "$restaurant",
        avgRating: { $avg: "$rating" },
        ratingsCount: { $sum: 1 },
      },
    },
  ]);

  const rating = Number((agg?.avgRating || 0).toFixed(2));
  const ratingsCount = agg?.ratingsCount || 0;

  await Restaurant.findByIdAndUpdate(restaurantId, {
    rating: ratingsCount ? rating : 4.2,
    ratingsCount,
  });
};

const createReview = async ({ userId, orderId, rating, comment }) => {
  const order = await Order.findById(orderId).populate("restaurant", "_id");

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (String(order.user) !== String(userId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You can review only your own orders");
  }

  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Only delivered orders can be reviewed");
  }

  const existing = await Review.findOne({ order: orderId });
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, "A review for this order already exists");
  }

  const review = await Review.create({
    user: userId,
    restaurant: order.restaurant,
    order: orderId,
    rating,
    comment,
  });

  await updateRestaurantRatings(order.restaurant);

  return Review.findById(review._id)
    .populate("user", "name")
    .populate("restaurant", "name")
    .populate("order", "shortId status totalAmount createdAt");
};

const getReviewsForUser = async ({ userId, limit = 20 }) => {
  return Review.find({ user: userId })
    .populate("restaurant", "name")
    .populate("order", "shortId status totalAmount createdAt")
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100));
};

const getReviewsForOwner = async ({ ownerId, restaurantId }) => {
  const restaurantQuery = { ownerId };
  if (restaurantId) {
    restaurantQuery._id = restaurantId;
  }

  const restaurants = await Restaurant.find(restaurantQuery).select("_id");
  const restaurantIds = restaurants.map((restaurant) => restaurant._id);

  if (!restaurantIds.length) {
    return [];
  }

  return Review.find({ restaurant: { $in: restaurantIds } })
    .populate("user", "name")
    .populate("restaurant", "name")
    .populate("order", "shortId status createdAt")
    .populate("ownerResponse.responder", "name")
    .sort({ createdAt: -1 });
};

const respondToReview = async ({ ownerId, reviewId, response }) => {
  const review = await Review.findById(reviewId).populate("restaurant", "ownerId");

  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  if (String(review.restaurant?.ownerId) !== String(ownerId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden");
  }

  review.ownerResponse = {
    text: response,
    respondedAt: new Date(),
    responder: ownerId,
  };

  await review.save();

  return Review.findById(review._id)
    .populate("user", "name")
    .populate("restaurant", "name")
    .populate("order", "shortId status createdAt")
    .populate("ownerResponse.responder", "name");
};

module.exports = {
  createReview,
  getReviewsForUser,
  getReviewsForOwner,
  respondToReview,
};
