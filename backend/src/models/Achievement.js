const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      // e.g., "FIRST_ORDER", "SPICE_LOVER", "NIGHT_OWL"
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String, // URL or identifier for the badge icon
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Achievement", achievementSchema);
