const express = require("express");
const pipelineController = require("../controllers/pipelineController");

const router = express.Router();

// Clickstream ingestion: browser events -> Kafka `foodex.clickstream`.
router.post("/", pipelineController.ingestEvents);

module.exports = router;
