const express = require("express");
const ownerController = require("../controllers/ownerController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");
const { upload } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.use(protect, authorize(ROLES.OWNER, ROLES.ADMIN));

router.get("/dashboard", ownerController.getDashboard);
router.get("/restaurants", ownerController.listMyRestaurants);
router.get("/orders", ownerController.listOwnerOrders);
router.patch("/orders/:orderId/status", ownerController.updateOwnerOrderStatus);
router.get("/orders/:orderId/invoice", ownerController.getOwnerOrderInvoice);
router.get("/orders/:orderId/invoice/pdf", ownerController.downloadOwnerOrderInvoice);

router.post("/restaurants/:restaurantId/menu", upload.single("image"), ownerController.createMenuItem);
router.patch("/menu/:menuItemId", upload.single("image"), ownerController.updateMenuItem);
router.delete("/menu/:menuItemId", ownerController.deleteMenuItem);

router.put("/restaurants/:restaurantId/promotions", ownerController.updatePromotions);
router.put("/restaurants/:restaurantId/featured-items", ownerController.setFeaturedItems);

module.exports = router;
