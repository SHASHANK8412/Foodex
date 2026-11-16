const express = require("express");
const analyticsSuiteController = require("../controllers/analyticsSuiteController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get("/", analyticsSuiteController.getSuite);
router.get("/export/csv", analyticsSuiteController.exportCsv);
router.get("/export/pdf", analyticsSuiteController.exportPdf);

module.exports = router;
