const crypto = require("crypto");
const Razorpay = require("razorpay");
const { StatusCodes } = require("http-status-codes");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { PAYMENT_METHODS } = require("../constants/order");

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

// "rahul.sharma@okhdfcbank" -> "ra***@okhdfcbank": enough to recognise, not to reuse.
const maskVpa = (vpa) => {
  const [handle, provider] = String(vpa || "").split("@");
  if (!handle || !provider) return undefined;
  return `${handle.slice(0, 2)}***@${provider}`;
};

/**
 * The method and its non-sensitive details from a Razorpay payment entity (from
 * GET /v1/payments/:id or a webhook payload).
 */
const describePayment = (entity = {}) => {
  const method = PAYMENT_METHODS.includes(entity.method) ? entity.method : "unknown";
  const details = {};
  if (method === "upi") {
    details.vpaMasked = maskVpa(entity.upi?.vpa || entity.vpa);
    details.upiFlow = entity.upi?.flow || undefined;
  }
  if (method === "card" && entity.card) {
    details.cardNetwork = entity.card.network || undefined;
    details.cardLast4 = entity.card.last4 || undefined;
  }
  if (method === "netbanking") details.bank = entity.bank || undefined;
  if (method === "wallet") details.wallet = entity.wallet || undefined;
  return { method, details };
};

// Looks up how a payment was made. Never throws: a lookup failure must not
// undo a payment whose signature already verified.
const fetchPaymentMethod = async (paymentId) => {
  if (!razorpayInstance || !paymentId) {
    return { method: "unknown", details: {} };
  }
  try {
    return describePayment(await razorpayInstance.payments.fetch(paymentId));
  } catch (_error) {
    return { method: "unknown", details: {} };
  }
};

module.exports = {
  maskVpa,
  describePayment,
  fetchPaymentMethod,
  createRazorpayOrder,
  verifySignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
};
