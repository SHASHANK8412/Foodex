const express = require("express");
const groupOrderController = require("../controllers/groupOrderController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(protect, authorize(ROLES.USER, ROLES.ADMIN));

router.post("/", groupOrderController.createGroupSession);
router.post("/join", groupOrderController.joinGroupSession);
router.get("/:inviteCode", groupOrderController.getGroupSession);
router.post("/:inviteCode/items", groupOrderController.addItem);
router.post("/:inviteCode/close", groupOrderController.closeSession);

module.exports = router;
