const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    cuisine: [{ type: String, trim: true }],
    address: {
      line1: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      location: {
        lat: Number,
        lng: Number,
      },
    },
    contactPhone: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    isOpen: { type: Boolean, default: true },
    avgPrepMinutes: { type: Number, default: 22 },
    activeOrders: { type: Number, default: 0 },
    demandLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    estimatedWaitMinutes: { type: Number, default: 20 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    featured: { type: Boolean, default: false },
    promotions: [
      {
        title: { type: String, trim: true },
        code: { type: String, trim: true },
        discountPercent: { type: Number, min: 0, max: 100 },
        startsAt: Date,
        endsAt: Date,
        active: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);
