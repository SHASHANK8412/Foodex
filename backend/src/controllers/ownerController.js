const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const ownerService = require("../services/ownerService");
const { toPdfBuffer } = require("../services/invoiceService");

const getDashboard = asyncHandler(async (req, res) => {
  const data = await ownerService.getOwnerDashboard(req.user.userId);
  res.status(StatusCodes.OK).json({ success: true, data });
});

const listMyRestaurants = asyncHandler(async (req, res) => {
  const data = await ownerService.getOwnerRestaurants(req.user.userId);
  res.status(StatusCodes.OK).json({ success: true, data });
});

const createMenuItem = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    imageUrl: req.file?.path || req.body.imageUrl,
  };

  const data = await ownerService.createMenuItemForOwner({
    ownerId: req.user.userId,
    restaurantId: req.params.restaurantId,
    payload,
  });

  res.status(StatusCodes.CREATED).json({ success: true, data });
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    ...(req.file?.path ? { imageUrl: req.file.path } : {}),
  };

  const data = await ownerService.updateMenuItemForOwner({
    ownerId: req.user.userId,
    menuItemId: req.params.menuItemId,
    payload,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const deleteMenuItem = asyncHandler(async (req, res) => {
  await ownerService.deleteMenuItemForOwner({
    ownerId: req.user.userId,
    menuItemId: req.params.menuItemId,
  });

  res.status(StatusCodes.OK).json({ success: true, message: "Menu item deleted" });
});

const updatePromotions = asyncHandler(async (req, res) => {
  const data = await ownerService.updateRestaurantPromotions({
    ownerId: req.user.userId,
    restaurantId: req.params.restaurantId,
    promotions: req.body.promotions || [],
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const setFeaturedItems = asyncHandler(async (req, res) => {
  const data = await ownerService.setFeaturedItems({
    ownerId: req.user.userId,
    restaurantId: req.params.restaurantId,
    itemIds: req.body.itemIds || [],
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const listOwnerOrders = asyncHandler(async (req, res) => {
  const data = await ownerService.getOwnerOrders({
    ownerId: req.user.userId,
    status: req.query.status,
    search: req.query.search,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const updateOwnerOrderStatus = asyncHandler(async (req, res) => {
  const data = await ownerService.updateOwnerOrderStatus({
    ownerId: req.user.userId,
    orderId: req.params.orderId,
    status: req.body.status,
    note: req.body.note,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const getOwnerOrderInvoice = asyncHandler(async (req, res) => {
  const data = await ownerService.getOwnerInvoiceByOrder({
    ownerId: req.user.userId,
    orderId: req.params.orderId,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const downloadOwnerOrderInvoice = asyncHandler(async (req, res) => {
  const invoice = await ownerService.getOwnerInvoiceByOrder({
    ownerId: req.user.userId,
    orderId: req.params.orderId,
  });

  const pdfBuffer = await toPdfBuffer(invoice);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${invoice.invoiceNumber}.pdf`);
  res.status(StatusCodes.OK).send(pdfBuffer);
});

module.exports = {
  getDashboard,
  listMyRestaurants,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  updatePromotions,
  setFeaturedItems,
  listOwnerOrders,
  updateOwnerOrderStatus,
  getOwnerOrderInvoice,
  downloadOwnerOrderInvoice,
};
