const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const AgentProposal = require("../models/AgentProposal");
const ApiError = require("../utils/ApiError");
const { planOrder } = require("../agent/orderingAgent");
const { validateCart } = require("../agent/validator");
const orderService = require("./orderService");

const toPublic = (proposal) => ({
  id: String(proposal._id),
  status: proposal.status,
  request: proposal.request,
  engine: proposal.engine,
  models: proposal.models || [],
  spec: proposal.spec,
  corrections: proposal.corrections || [],
  restaurant: proposal.restaurant ? { id: String(proposal.restaurant._id || proposal.restaurant), name: proposal.restaurant.name } : null,
  items: (proposal.items || []).map((line) => ({
    menuItemId: String(line.menuItemId),
    name: line.name,
    quantity: line.quantity,
    price: line.price,
  })),
  quote: proposal.quote || null,
  etaMinutes: proposal.etaMinutes ?? null,
  checks: proposal.checks || [],
  summary: proposal.summary || "",
  reason: proposal.reason || "",
  closestOption: proposal.closestOption || "",
  proposals: proposal.proposals || 0,
  trace: (proposal.trace || []).map(({ kind, summary, attempt, passed, corrections }) => ({ kind, summary, attempt, passed, corrections })),
  usage: proposal.usage || {},
  latencyMs: proposal.latencyMs,
  orderId: proposal.order ? String(proposal.order) : null,
  expiresAt: proposal.expiresAt,
});

/** Plans a cart and stores it as a proposal; nothing is ordered. */
const plan = async ({ userId, text, onEvent }) => {
  const request = String(text || "").trim();
  if (request.length < 3) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Describe what you'd like to order");
  }

  const result = await planOrder({ text: request, onEvent });
  const validation = result.validation;

  const proposal = await AgentProposal.create({
    user: userId,
    request: result.request,
    status: result.status,
    engine: result.engine,
    models: result.models,
    spec: result.spec,
    corrections: result.corrections,
    restaurant: validation?.restaurant?.id,
    items: (validation?.lines || []).map((line) => ({ menuItemId: line.menuItemId, name: line.name, quantity: line.quantity, price: line.price })),
    quote: validation?.quote,
    etaMinutes: validation?.eta?.minutes,
    checks: validation?.checks || [],
    summary: validation?.summary,
    reason: result.reason || undefined,
    fallbackReason: result.fallbackReason || undefined,
    closestOption: result.closestOption || undefined,
    proposals: result.proposals,
    trace: result.trace,
    usage: result.usage,
    latencyMs: result.latencyMs,
  });

  return toPublic(await proposal.populate("restaurant", "name"));
};

const findOwnProposal = async ({ userId, proposalId }) => {
  if (!mongoose.isValidObjectId(proposalId)) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Proposal not found");
  }
  const proposal = await AgentProposal.findById(proposalId).populate("restaurant", "name");
  if (!proposal || String(proposal.user) !== String(userId)) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Proposal not found");
  }
  return proposal;
};

const getProposal = async ({ userId, proposalId }) => toPublic(await findOwnProposal({ userId, proposalId }));

/**
 * The only path from an agent proposal to an order. The customer has seen the
 * cart and pressed confirm; the cart is validated again (prices, availability
 * and delivery time may have changed) and, if anything differs from what they
 * saw, they are asked to review it instead of being charged a different amount.
 */
const confirm = async ({ userId, proposalId, deliveryAddress, contactPhone }) => {
  const proposal = await findOwnProposal({ userId, proposalId });

  if (proposal.status === "confirmed") {
    throw new ApiError(StatusCodes.CONFLICT, "This proposal has already been ordered");
  }
  if (proposal.status !== "proposed") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "There is no cart to confirm in this proposal");
  }
  if (proposal.expiresAt && proposal.expiresAt < new Date()) {
    throw new ApiError(StatusCodes.GONE, "This proposal has expired; ask the assistant again");
  }

  const items = proposal.items.map((line) => ({ menuItemId: String(line.menuItemId), quantity: line.quantity }));
  const recheck = await validateCart({ spec: proposal.spec, restaurantId: String(proposal.restaurant._id || proposal.restaurant), items });

  if (!recheck.passed) {
    proposal.checks = recheck.checks;
    await proposal.save();
    throw Object.assign(new ApiError(StatusCodes.CONFLICT, "The cart no longer meets your request"), {
      details: recheck.checks.filter((entry) => !entry.passed),
    });
  }

  if (Math.abs(recheck.quote.totalAmount - (proposal.quote?.totalAmount ?? 0)) > 0.009) {
    proposal.quote = recheck.quote;
    proposal.checks = recheck.checks;
    await proposal.save();
    throw Object.assign(new ApiError(StatusCodes.CONFLICT, "The price changed since the cart was proposed; review the new total"), {
      details: [{ id: "price_changed", label: "New total", detail: recheck.quote.totalAmount }],
    });
  }

  const result = await orderService.createOrder({
    userId,
    restaurantId: String(proposal.restaurant._id || proposal.restaurant),
    items,
    deliveryAddress,
    contactPhone,
  });

  proposal.status = "confirmed";
  proposal.order = result.order._id;
  proposal.expiresAt = undefined;
  await proposal.save();

  return result;
};

module.exports = { plan, getProposal, confirm, toPublic };
