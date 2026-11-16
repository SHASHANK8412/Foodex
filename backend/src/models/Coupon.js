const mongoose = require("mongoose");

const DISCOUNT_TYPES = ["percent", "flat", "free_delivery"];

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    // Percent (0-100) for "percent", rupees for "flat", ignored for "free_delivery".
    value: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    perUserLimit: { type: Number, min: 1 },
    // Limits the coupon to one restaurant; unset means platform-wide.
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
    startsAt: Date,
    endsAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.statics.DISCOUNT_TYPES = DISCOUNT_TYPES;

module.exports = mongoose.model("Coupon", couponSchema);
