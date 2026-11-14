const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const agentService = require("../services/agentService");

// POST /api/agent/plan. With ?stream=1 the agent's steps are streamed as
// Server-Sent Events while it works, ending with a "result" event; otherwise
// one JSON response when it finishes.
const plan = asyncHandler(async (req, res) => {
  const text = req.body?.request;

  if (req.query.stream !== "1") {
    const proposal = await agentService.plan({ userId: req.user.userId, text });
    return res.status(StatusCodes.OK).json({ success: true, data: proposal });
  }

  res.status(StatusCodes.OK);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // tell nginx not to buffer the stream
  res.flushHeaders();

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 15000);

  try {
    const proposal = await agentService.plan({ userId: req.user.userId, text, onEvent: send });
    send({ type: "result", proposal });
  } catch (error) {
    req.log?.error({ err: error }, "Agent planning failed");
    send({ type: "error", message: error.statusCode && error.statusCode < 500 ? error.message : "The assistant could not finish. Try again." });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
  return undefined;
});

const getProposal = asyncHandler(async (req, res) => {
  const data = await agentService.getProposal({ userId: req.user.userId, proposalId: req.params.proposalId });
  res.status(StatusCodes.OK).json({ success: true, data });
});

const confirm = asyncHandler(async (req, res) => {
  const data = await agentService.confirm({
    userId: req.user.userId,
    proposalId: req.params.proposalId,
    deliveryAddress: req.body?.deliveryAddress,
    contactPhone: req.body?.contactPhone,
  });
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

module.exports = { plan, getProposal, confirm };
