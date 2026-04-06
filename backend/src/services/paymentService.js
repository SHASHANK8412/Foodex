const crypto = require("crypto");
const Razorpay = require("razorpay");
const { StatusCodes } = require("http-status-codes");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const isRazorpayConfigured = Boolean(env.razorpayKeyId && env.razorpayKeySecret);

const razorpayInstance = isRazorpayConfigured
  ? new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    })
  : null;

const createRazorpayOrder = async ({ amount, receipt, notes }) => {
  if (!isRazorpayConfigured) {
    return {
      id: `mock_order_${Date.now()}`,
      amount,
      currency: "INR",
      receipt,
      notes,
      isMock: true,
    };
  }

  return razorpayInstance.orders.create({
    amount,
    currency: "INR",
    receipt,
    notes,
    payment_capture: 1,
  });
};

const verifySignature = ({ orderId, paymentId, signature }) => {
  if (!env.razorpayKeySecret) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Razorpay secret is not configured");
  }

  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac("sha256", env.razorpayKeySecret).update(body).digest("hex");

  return expected === signature;
};

const verifyWebhookSignature = ({ rawBody, signature }) => {
  if (!env.webhookSecret) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Razorpay webhook secret is not configured");
  }

  const expected = crypto.createHmac("sha256", env.webhookSecret).update(rawBody).digest("hex");
  return expected === signature;
};

module.exports = {
  createRazorpayOrder,
  verifySignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
};
