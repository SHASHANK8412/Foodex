const mongoose = require("mongoose");
const crypto = require("crypto");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/order");

const orderSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(4).toString("hex").toUpperCase(),
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    items: [
      {
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    deliveryAddress: {
      line1: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      location: {
        lat: Number,
        lng: Number,
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true, index: true },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    // "razorpay" until paid, then the method actually used: upi, card, netbanking, wallet...
    paymentMethod: { type: String, default: "razorpay" },
    paymentDetails: {
      vpaMasked: String,
      upiFlow: String,
      cardNetwork: String,
      cardLast4: String,
      bank: String,
      wallet: String,
      simulated: Boolean,
    },
    // For the rider and for payment prefill; Indian mobile number, 10 digits.
    contactPhone: { type: String, trim: true },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    trackingEvents: [
      {
        status: { type: String, required: true },
        note: String,
        location: {
          lat: Number,
          lng: Number,
        },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
