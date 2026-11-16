const mongoose = require("mongoose");
const { PAYMENT_STATUS, PAYMENT_METHODS } = require("../constants/order");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true, unique: true },
    provider: { type: String, default: "razorpay", index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    // How the customer paid, from Razorpay's Payments API (or the choice made in mock mode).
    method: { type: String, enum: PAYMENT_METHODS, index: true },
    methodDetails: {
      vpaMasked: String,
      upiFlow: String,
      cardNetwork: String,
      cardLast4: String,
      bank: String,
      wallet: String,
      simulated: Boolean,
    },
    paidAt: { type: Date },
    lastEventAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
