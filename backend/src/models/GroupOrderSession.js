const mongoose = require("mongoose");

const groupOrderSessionSchema = new mongoose.Schema(
  {
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, trim: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    items: [
      {
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
        name: { type: String, required: true },
        unitPrice: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        addedByName: { type: String, trim: true },
        lineTotal: { type: Number, required: true, min: 0 },
      },
    ],
    status: {
      type: String,
      enum: ["open", "locked", "closed"],
      default: "open",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

groupOrderSessionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("GroupOrderSession", groupOrderSessionSchema);
