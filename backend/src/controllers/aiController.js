const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const aiService = require("../services/aiService");
const { generateContent } = require("../services/generativeAiService");

const chat = asyncHandler(async (req, res) => {
  const result = await aiService.chatOrderAssistant({
    userId: String(req.user.userId),
    message: req.body.message,
  });

  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const chatStream = asyncHandler(async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const writeEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const result = await aiService.streamAssistantResponse({
    userId: String(req.user.userId),
    message: req.body.message,
    onChunk: (chunk) => writeEvent("chunk", { chunk }),
  });

  writeEvent("done", result);
  res.end();
});

const semanticSearch = asyncHandler(async (req, res) => {
  const data = await aiService.semanticSearchMenuItems({
    query: req.body.query,
    restaurantId: req.body.restaurantId,
    limit: Number(req.body.limit || 12),
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const compareItem = asyncHandler(async (req, res) => {
  const data = await aiService.compareDishAcrossRestaurants({
    dish: req.body.item || req.body.dish,
    budget: req.body.budget,
    isVeg: req.body.isVeg,
    spicy: req.body.spicy,
    limit: Number(req.body.limit || 8),
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const recommendations = asyncHandler(async (req, res) => {
  const data = await aiService.getCollaborativeRecommendations({
    userId: String(req.user.userId),
    limit: Number(req.query.limit || 8),
    restaurantId: req.query.restaurantId,
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const quickReorder = asyncHandler(async (req, res) => {
  const data = await aiService.getQuickReorderPrediction({
    userId: String(req.user.userId),
  });

  res.status(StatusCodes.OK).json({ success: true, data });
});

/**
 * @desc    Generate content based on a prompt
 * @route   POST /api/v1/ai/generate
 * @access  Private
 */
const generateAiContent = asyncHandler(async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, message: "Prompt is required" });
  }

  try {
    const generatedText = await generateContent(prompt);

    res.status(200).json({
      success: true,
      data: generatedText,
    });
  } catch (error) {
    // Handle specific error cases
    if (error.message.includes("quota exceeded")) {
      return res.status(429).json({
        success: false,
        message: "API quota exceeded. Please try again later or upgrade your plan.",
        details: error.message,
      });
    }

    if (error.message.includes("API key")) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired API key.",
        details: error.message,
      });
    }

    // Re-throw for asyncHandler to catch
    throw error;
  }
});

module.exports = {
  chat,
  chatStream,
  semanticSearch,
  compareItem,
  recommendations,
  quickReorder,
  generateAiContent,
};
