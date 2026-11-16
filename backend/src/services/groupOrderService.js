const crypto = require("crypto");
const { StatusCodes } = require("http-status-codes");
const ApiError = require("../utils/ApiError");
const GroupOrderSession = require("../models/GroupOrderSession");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");

const SESSION_TTL_HOURS = 4;

const buildInviteCode = () => crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

const sanitizeSession = async (sessionId) => {
  return GroupOrderSession.findById(sessionId)
    .populate("restaurant", "name imageUrl address")
    .populate("host", "name")
    .populate("members.user", "name")
    .populate("items.addedBy", "name")
    .sort({ createdAt: -1 });
};

const ensureActiveSession = (session) => {
  if (!session) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Group order session not found");
  }

  if (session.status !== "open") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Group order session is not open");
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Group order session has expired");
  }
};

const ensureMember = (session, userId) => {
  const isMember = session.members.some((member) => String(member.user) === String(userId));
  if (!isMember) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Join this group order first");
  }
};

const createGroupOrderSession = async ({ user, restaurantId }) => {
  const restaurant = await Restaurant.findById(restaurantId).select("_id");
  if (!restaurant) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
  }

  let inviteCode = buildInviteCode();
  let attempts = 0;

  while (attempts < 5) {
    const exists = await GroupOrderSession.findOne({ inviteCode });
    if (!exists) {
      break;
    }
    inviteCode = buildInviteCode();
    attempts += 1;
  }

  const session = await GroupOrderSession.create({
    inviteCode,
    restaurant: restaurantId,
    host: user.userId,
    members: [{ user: user.userId, name: user.name }],
    items: [],
    expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000),
  });

  return sanitizeSession(session._id);
};

const joinGroupOrderSession = async ({ user, inviteCode }) => {
  const session = await GroupOrderSession.findOne({ inviteCode: String(inviteCode || "").toUpperCase() });
  ensureActiveSession(session);

  const existing = session.members.find((member) => String(member.user) === String(user.userId));
  if (!existing) {
    session.members.push({
      user: user.userId,
      name: user.name,
      joinedAt: new Date(),
    });
    await session.save();
  }

  return sanitizeSession(session._id);
};

const getGroupOrderSession = async ({ userId, inviteCode }) => {
  const session = await GroupOrderSession.findOne({ inviteCode: String(inviteCode || "").toUpperCase() });
  ensureActiveSession(session);
  ensureMember(session, userId);

  return sanitizeSession(session._id);
};

const addItemToGroupOrder = async ({ user, inviteCode, menuItemId, quantity }) => {
  const session = await GroupOrderSession.findOne({ inviteCode: String(inviteCode || "").toUpperCase() });
  ensureActiveSession(session);
  ensureMember(session, user.userId);

  const menuItem = await MenuItem.findById(menuItemId);
  if (!menuItem || String(menuItem.restaurant) !== String(session.restaurant)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Item does not belong to this restaurant");
  }

  if (!menuItem.isAvailable) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Item is currently unavailable");
  }

  const safeQty = Math.max(1, Number(quantity) || 1);
  const existing = session.items.find(
    (item) => String(item.menuItem) === String(menuItem._id) && String(item.addedBy) === String(user.userId)
  );

  if (existing) {
    existing.quantity += safeQty;
    existing.lineTotal = Number((existing.quantity * existing.unitPrice).toFixed(2));
  } else {
    const unitPrice = Number(menuItem.discountedPrice || menuItem.price || 0);
    session.items.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      unitPrice,
      quantity: safeQty,
      addedBy: user.userId,
      addedByName: user.name,
      lineTotal: Number((unitPrice * safeQty).toFixed(2)),
    });
  }

  await session.save();
  return sanitizeSession(session._id);
};

const closeGroupOrderSession = async ({ userId, inviteCode }) => {
  const session = await GroupOrderSession.findOne({ inviteCode: String(inviteCode || "").toUpperCase() });
  ensureActiveSession(session);

  if (String(session.host) !== String(userId)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Only host can close group order");
  }

  session.status = "closed";
  await session.save();

  const split = new Map();
  session.items.forEach((item) => {
    const key = String(item.addedBy);
    split.set(key, (split.get(key) || 0) + item.lineTotal);
  });

  return {
    inviteCode: session.inviteCode,
    status: session.status,
    splitSummary: Array.from(split.entries()).map(([userIdKey, amount]) => {
      const member = session.members.find((entry) => String(entry.user) === userIdKey);
      return {
        userId: userIdKey,
        name: member?.name || "Member",
        amount: Number(amount.toFixed(2)),
      };
    }),
  };
};

module.exports = {
  createGroupOrderSession,
  joinGroupOrderSession,
  getGroupOrderSession,
  addItemToGroupOrder,
  closeGroupOrderSession,
};
