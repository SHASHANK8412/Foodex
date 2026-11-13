const express = require("express");
const pipelineController = require("../controllers/pipelineController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get("/status", pipelineController.getStatus);
router.get("/realtime", pipelineController.getRealtime);
router.get("/insights", pipelineController.getInsights);
router.post("/simulate", pipelineController.simulate);

module.exports = router;
