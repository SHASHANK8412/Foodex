const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    customerSnapshot: {
      name: String,
      email: String,
      phone: String,
      address: {
        line1: String,
        city: String,
        state: String,
        postalCode: String,
      },
    },
    restaurantSnapshot: {
      name: String,
      address: {
        line1: String,
        city: String,
        state: String,
        postalCode: String,
      },
      contactPhone: String,
    },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    deliveryCharges: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    generatedAt: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ["generated", "void"], default: "generated" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
