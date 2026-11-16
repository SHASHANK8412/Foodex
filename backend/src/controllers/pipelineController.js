const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const pipelineService = require("../services/pipelineService");

// Clickstream is accepted from signed-out visitors too, so the token is optional:
// a valid one attaches the user id, anything else is treated as anonymous.
const userIdFromRequest = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  try {
    return jwt.verify(header.split(" ")[1], env.jwtSecret).userId || null;
  } catch (_error) {
    return null;
  }
};

const ingestEvents = asyncHandler(async (req, res) => {
  const data = await pipelineService.ingestClickstream({
    sessionId: req.body?.sessionId,
    events: req.body?.events,
    userId: userIdFromRequest(req),
  });

  res.status(StatusCodes.ACCEPTED).json({ success: true, data });
});

const getStatus = asyncHandler(async (_req, res) => {
  const data = await pipelineService.getStatus();
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getRealtime = asyncHandler(async (_req, res) => {
  res.status(StatusCodes.OK).json({ success: true, data: pipelineService.getRealtimeSnapshot() });
});

const getInsights = asyncHandler(async (_req, res) => {
  res.status(StatusCodes.OK).json({ success: true, data: pipelineService.getBatchInsights() });
});

const simulate = asyncHandler(async (req, res) => {
  const data = await pipelineService.simulateTraffic({ orders: req.body?.orders });
  res.status(StatusCodes.ACCEPTED).json({ success: true, data });
});

module.exports = {
  ingestEvents,
  getStatus,
  getRealtime,
  getInsights,
  simulate,
};
