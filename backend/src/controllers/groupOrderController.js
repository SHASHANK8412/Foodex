const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const groupOrderService = require("../services/groupOrderService");

const createGroupSession = asyncHandler(async (req, res) => {
  const data = await groupOrderService.createGroupOrderSession({
    user: req.user,
    restaurantId: req.body.restaurantId,
  });

  res.status(StatusCodes.CREATED).json({ success: true, data });
});

const joinGroupSession = asyncHandler(async (req, res) => {
  const data = await groupOrderService.joinGroupOrderSession({
    user: req.user,
    inviteCode: req.body.inviteCode,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const getGroupSession = asyncHandler(async (req, res) => {
  const data = await groupOrderService.getGroupOrderSession({
    userId: req.user.userId,
    inviteCode: req.params.inviteCode,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const addItem = asyncHandler(async (req, res) => {
  const data = await groupOrderService.addItemToGroupOrder({
    user: req.user,
    inviteCode: req.params.inviteCode,
    menuItemId: req.body.menuItemId,
    quantity: req.body.quantity,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const closeSession = asyncHandler(async (req, res) => {
  const data = await groupOrderService.closeGroupOrderSession({
    userId: req.user.userId,
    inviteCode: req.params.inviteCode,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  createGroupSession,
  joinGroupSession,
  getGroupSession,
  addItem,
  closeSession,
};
