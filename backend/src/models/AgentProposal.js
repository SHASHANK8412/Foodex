const mongoose = require("mongoose");

// A cart the ordering agent proposed, waiting for the customer to confirm it.
// Nothing is ordered or charged until POST /api/agent/proposals/:id/confirm.
// Unconfirmed proposals expire (TTL index) after PROPOSAL_TTL_MINUTES.
const PROPOSAL_TTL_MINUTES = 30;

const agentProposalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    request: { type: String, required: true },
    status: { type: String, enum: ["proposed", "declined", "failed", "confirmed"], required: true },
    engine: { type: String, required: true },
    models: [String],
    spec: { type: mongoose.Schema.Types.Mixed, required: true },
    corrections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
    items: [
      {
        _id: false,
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
        name: String,
        quantity: Number,
        price: Number,
      },
    ],
    quote: mongoose.Schema.Types.Mixed,
    etaMinutes: Number,
    checks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    summary: String,
    reason: String,
    closestOption: String,
    proposals: Number,
    trace: { type: [mongoose.Schema.Types.Mixed], default: [] },
    usage: mongoose.Schema.Types.Mixed,
    latencyMs: Number,
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    expiresAt: { type: Date, default: () => new Date(Date.now() + PROPOSAL_TTL_MINUTES * 60 * 1000) },
  },
  { timestamps: true }
);

// MongoDB removes documents once expiresAt passes; confirmed ones are kept (expiresAt unset).
agentProposalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

agentProposalSchema.statics.PROPOSAL_TTL_MINUTES = PROPOSAL_TTL_MINUTES;

module.exports = mongoose.model("AgentProposal", agentProposalSchema);
