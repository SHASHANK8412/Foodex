const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const pricingService = require("../services/pricingService");

const getQuote = asyncHandler(async (req, res) => {
  const result = await pricingService.quote({
    restaurantId: req.body.restaurantId,
    items: req.body.items,
    couponCode: req.body.couponCode,
    userId: req.user?.userId,
  });

  res.status(StatusCodes.OK).json({ success: true, data: pricingService.toQuoteResponse(result) });
});

const listOffers = asyncHandler(async (_req, res) => {
  res.status(StatusCodes.OK).json({ success: true, data: await pricingService.listActiveOffers() });
});

module.exports = { getQuote, listOffers };
