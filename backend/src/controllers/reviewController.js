const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const reviewService = require("../services/reviewService");

const createReview = asyncHandler(async (req, res) => {
  const data = await reviewService.createReview({
    userId: req.user.userId,
    orderId: req.body.orderId,
    rating: Number(req.body.rating),
    comment: req.body.comment,
  });

  res.status(StatusCodes.CREATED).json({ success: true, data });
});

const listMyReviews = asyncHandler(async (req, res) => {
  const data = await reviewService.getReviewsForUser({
    userId: req.user.userId,
    limit: req.query.limit,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const listOwnerReviews = asyncHandler(async (req, res) => {
  const data = await reviewService.getReviewsForOwner({
    ownerId: req.user.userId,
    restaurantId: req.query.restaurantId,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const respondToReview = asyncHandler(async (req, res) => {
  const data = await reviewService.respondToReview({
    ownerId: req.user.userId,
    reviewId: req.params.reviewId,
    response: req.body.response,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  createReview,
  listMyReviews,
  listOwnerReviews,
  respondToReview,
};
