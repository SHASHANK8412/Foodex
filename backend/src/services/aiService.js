const { generateContent } = require("./generativeAiService");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Pinecone } = require("@pinecone-database/pinecone");
const { StatusCodes } = require("http-status-codes");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const memoryStore = new Map();

const getMemory = (userId) => {
  if (!memoryStore.has(userId)) {
    memoryStore.set(userId, []);
  }
  return memoryStore.get(userId);
};

const addToMemory = (userId, role, content) => {
  const memory = getMemory(userId);
  memory.push({ role, content, timestamp: new Date().toISOString() });
  if (memory.length > 12) {
    memory.shift();
  }
};

const getEmbeddingsClient = () => {
  if (!env.openaiApiKey) {
    return null;
  }

  return new OpenAIEmbeddings({
    apiKey: env.openaiApiKey,
    model: env.embeddingModel,
  });
};

const cosineSimilarity = (a = [], b = []) => {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom ? dot / denom : 0;
};

const buildSemanticText = (item) => {
  return [item.name, item.description, item.category, ...(item.tags || [])].filter(Boolean).join(" ");
};

const ensureMenuEmbedding = async (item, embeddingsClient) => {
  if (!embeddingsClient || item.embedding?.length) {
    return item;
  }

  const text = item.semanticText || buildSemanticText(item);
  const vector = await embeddingsClient.embedQuery(text);
  item.embedding = vector;
  item.semanticText = text;
  await item.save();
  return item;
};

const semanticSearchMenuItems = async ({ query, restaurantId, limit = 12 }) => {
  const baseQuery = {
    isAvailable: true,
  };

  if (restaurantId) {
    baseQuery.restaurant = restaurantId;
  }

  const embeddingsClient = getEmbeddingsClient();

  if (env.pineconeApiKey && env.pineconeIndex && embeddingsClient) {
    try {
      const pinecone = new Pinecone({ apiKey: env.pineconeApiKey });
      const index = pinecone.index(env.pineconeIndex);
      const queryVector = await embeddingsClient.embedQuery(query);
      const pineconeResult = await index.query({
        topK: limit,
        vector: queryVector,
        includeMetadata: true,
      });

      const ids = (pineconeResult.matches || []).map((match) => match.metadata?.menuItemId).filter(Boolean);
      if (ids.length) {
        const docs = await MenuItem.find({ _id: { $in: ids } }).populate("restaurant", "name demandLevel estimatedWaitMinutes");
        return docs;
      }
    } catch (_error) {
      // Fallback to Mongo-based semantic scoring.
    }
  }

  if (embeddingsClient && env.useAtlasVectorSearch) {
    try {
      const queryVector = await embeddingsClient.embedQuery(query);
      const pipeline = [
        {
          $vectorSearch: {
            index: "menu_embedding_index",
            path: "embedding",
            queryVector,
            numCandidates: 100,
            limit,
            filter: restaurantId ? { restaurant: restaurantId } : undefined,
          },
        },
        {
          $match: { isAvailable: true },
        },
      ];

      const items = await MenuItem.aggregate(pipeline);
      const ids = items.map((item) => item._id);
      if (ids.length) {
        return MenuItem.find({ _id: { $in: ids } }).populate("restaurant", "name demandLevel estimatedWaitMinutes");
      }
    } catch (_error) {
      // Atlas vector search index may not be configured yet.
    }
  }

  const docs = await MenuItem.find(baseQuery)
    .populate("restaurant", "name demandLevel estimatedWaitMinutes")
    .sort({ popularityScore: -1 })
    .limit(80);

  if (!embeddingsClient) {
    const q = query.toLowerCase();
    return docs
      .filter((item) => buildSemanticText(item).toLowerCase().includes(q))
      .slice(0, limit);
  }

  const queryVector = await embeddingsClient.embedQuery(query);
  const scored = [];

  for (const item of docs) {
    const hydrated = await ensureMenuEmbedding(item, embeddingsClient);
    scored.push({
      item: hydrated,
      score: cosineSimilarity(queryVector, hydrated.embedding || []),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
};

const getCollaborativeRecommendations = async ({ userId, limit = 8, restaurantId }) => {
  const userOrders = await Order.find({ user: userId }).sort({ createdAt: -1 }).limit(40);
  const myMenuItemIds = new Set(userOrders.flatMap((order) => order.items.map((item) => String(item.menuItem))));

  const peerOrders = await Order.find({
    "items.menuItem": { $in: Array.from(myMenuItemIds) },
    user: { $ne: userId },
    ...(restaurantId ? { restaurant: restaurantId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(120);

  const scoreMap = new Map();

  peerOrders.forEach((order) => {
    order.items.forEach((item) => {
      const id = String(item.menuItem);
      if (!myMenuItemIds.has(id)) {
        scoreMap.set(id, (scoreMap.get(id) || 0) + item.quantity);
      }
    });
  });

  const sortedIds = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, limit);
  const mayLike = await MenuItem.find({ _id: { $in: sortedIds }, isAvailable: true }).populate(
    "restaurant",
    "name demandLevel estimatedWaitMinutes"
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const trendingAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.menuItem", score: { $sum: "$items.quantity" } } },
    { $sort: { score: -1 } },
    { $limit: limit },
  ]);

  const trendingIds = trendingAgg.map((item) => item._id);
  const trending = await MenuItem.find({ _id: { $in: trendingIds }, isAvailable: true }).populate(
    "restaurant",
    "name demandLevel estimatedWaitMinutes"
  );

  return {
    mayLike,
    trending,
  };
};

const getQuickReorderPrediction = async ({ userId }) => {
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).limit(80);
  if (!orders.length) {
    return [];
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  const scoreMap = new Map();

  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt);
    const hourDistance = Math.min(Math.abs(createdAt.getHours() - currentHour), 24 - Math.abs(createdAt.getHours() - currentHour));
    const dayMatchBoost = createdAt.getDay() === currentDay ? 1.3 : 1;
    const recencyFactor = Math.max(0.55, 1 - (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 40));

    order.items.forEach((item) => {
      const key = String(item.menuItem);
      const base = item.quantity * dayMatchBoost * recencyFactor * (1 / (1 + hourDistance / 4));
      scoreMap.set(key, (scoreMap.get(key) || 0) + base);
    });
  });

  const topIds = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  return MenuItem.find({ _id: { $in: topIds }, isAvailable: true }).populate("restaurant", "name demandLevel estimatedWaitMinutes");
};

const extractBudget = (text) => {
  const match = text.match(/(?:under|below|less than|within)\s*[₹rs\.\s]*(\d+)/i);
  return match ? Number(match[1]) : null;
};

const extractJsonBlock = (rawText = "") => {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(rawText.slice(start, end + 1));
  } catch (_error) {
    return null;
  }
};

const inferIntentWithGemini = async ({ memory, message }) => {
  if (!env.googleGeminiApiKey) {
    return null;
  }

  const prompt = [
    "You are Foodex AI order assistant.",
    "Extract food ordering intent from user input and return ONLY valid JSON.",
    "JSON schema:",
    '{"intent":"search|recommend|compare","cuisine":"string|null","dish":"string|null","spicy":true,"isVeg":false,"budget":300,"quantity":1,"semanticQuery":"string"}',
    "If uncertain, keep fields null and quantity as 1.",
    `Conversation memory: ${JSON.stringify(memory)}`,
    `User message: ${message}`,
  ].join("\n");

  const raw = await generateContent(prompt);
  return extractJsonBlock(raw);
};

const chatOrderAssistant = async ({ userId, message }) => {
  const memory = getMemory(userId);
  addToMemory(userId, "user", message);

  let parsedIntent = {
    intent: "search",
    cuisine: null,
    dish: null,
    spicy: false,
    isVeg: false,
    budget: extractBudget(message),
    quantity: 1,
  };

  if (env.googleGeminiApiKey) {
    try {
      const intent = await inferIntentWithGemini({ memory, message });
      if (intent) {
        parsedIntent = {
          ...parsedIntent,
          ...intent,
        };
      }
    } catch (_error) {
      // Graceful fallback to regex parsing.
    }
  }

  const semanticQuery = parsedIntent.semanticQuery || message;
  let candidates = await semanticSearchMenuItems({ query: semanticQuery, limit: 10 });

  if (parsedIntent.budget) {
    candidates = candidates.filter((item) => item.price <= parsedIntent.budget);
  }

  if (parsedIntent.spicy) {
    candidates = candidates.filter((item) => (item.tags || []).some((tag) => String(tag).toLowerCase().includes("spicy")) || item.description?.toLowerCase().includes("spicy"));
  }

  if (parsedIntent.isVeg) {
    candidates = candidates.filter((item) => item.isVeg === true);
  }

  if (parsedIntent.dish) {
    candidates = candidates.filter((item) => item.name.toLowerCase().includes(String(parsedIntent.dish).toLowerCase()));
  }

  const topPick = candidates[0] || null;

  let assistantMessage = "I could not find a perfect match yet. Want me to broaden the search?";
  const actions = [];

  if (topPick) {
    actions.push({
      type: "add_to_cart",
      payload: {
        menuItemId: String(topPick._id),
        restaurantId: String(topPick.restaurant?._id || topPick.restaurant),
        name: topPick.name,
        image: topPick.image?.url || "",
        price: topPick.price,
        quantity: parsedIntent.quantity || 1,
      },
    });

    assistantMessage = `I found ${topPick.name} at Rs.${topPick.price}. I can add ${parsedIntent.quantity || 1} to your cart now.`;
  }

  if (candidates.length > 1) {
    assistantMessage += ` I also found ${candidates.length - 1} similar options.`;
  }

  addToMemory(userId, "assistant", assistantMessage);

  return {
    reply: assistantMessage,
    actions,
    suggestions: candidates.slice(0, 5),
    memory: getMemory(userId),
  };
};

const streamAssistantResponse = async ({ userId, message, onChunk }) => {
  const result = await chatOrderAssistant({ userId, message });
  const tokens = result.reply.split(" ");

  for (let i = 0; i < tokens.length; i += 1) {
    onChunk(tokens[i] + (i === tokens.length - 1 ? "" : " "));
    await new Promise((resolve) => setTimeout(resolve, 24));
  }

  return result;
};

const ensureAiAccess = () => {
  if (!env.openaiApiKey) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "OPENAI_API_KEY is missing. Add it to backend .env to enable full AI mode.");
  }
};

module.exports = {
  semanticSearchMenuItems,
  getCollaborativeRecommendations,
  getQuickReorderPrediction,
  chatOrderAssistant,
  streamAssistantResponse,
  ensureAiAccess,
};
