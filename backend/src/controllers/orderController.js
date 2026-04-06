const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const orderService = require("../services/orderService");

const createOrder = asyncHandler(async (req, res) => {
  const result = await orderService.createOrder({
    userId: req.user.userId,
    ...req.body,
  });

  res.status(StatusCodes.CREATED).json({ success: true, data: result });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const order = await orderService.verifyOrderPayment(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: order });
});

const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : JSON.stringify(req.body);

  const result = await orderService.processRazorpayWebhook({
    rawBody,
    signature,
  });

  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getOrdersForUser(req.user);
  res.status(StatusCodes.OK).json({ success: true, data: orders });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.orderId, req.user);
  res.status(StatusCodes.OK).json({ success: true, data: order });
});

const updateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus({
    orderId: req.params.orderId,
    status: req.body.status,
    note: req.body.note,
    location: req.body.location,
    actorId: req.user.userId,
  });

  res.status(StatusCodes.OK).json({ success: true, data: order });
});

const assignDeliveryPartner = asyncHandler(async (req, res) => {
  const order = await orderService.assignDeliveryPartner({
    orderId: req.params.orderId,
    deliveryPartnerId: req.body.deliveryPartnerId,
    actorId: req.user.userId,
  });

  res.status(StatusCodes.OK).json({ success: true, data: order });
});

module.exports = {
  createOrder,
  verifyPayment,
  razorpayWebhook,
  listOrders,
  getOrder,
  updateStatus,
  assignDeliveryPartner,
};
