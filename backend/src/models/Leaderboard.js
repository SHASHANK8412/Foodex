const mongoose = require("mongoose");

const leaderboardEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rank: {
      type: Number,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    // Add user details here to avoid population, e.g., name, city
    userName: String,
    userCity: String,
  },
  { _id: false }
);

const leaderboardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      // e.g., "WEEKLY_SPEND", "MONTHLY_POINTS"
    },
    period: {
      type: String,
      required: true,
      // e.g., "2026-W15", "2026-04"
    },
    city: {
      type: String,
      // Can be null for global leaderboards
    },
    entries: [leaderboardEntrySchema],
  },
  { timestamps: true }
);

leaderboardSchema.index({ type: 1, period: 1, city: 1 }, { unique: true });

module.exports = mongoose.model("Leaderboard", leaderboardSchema);
