const { generateContent } = require("./generativeAiService");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Pinecone } = require("@pinecone-database/pinecone");
const { StatusCodes } = require("http-status-codes");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const Review = require("../models/Review");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const memoryStore = new Map();
const sessionStateStore = new Map();
let geminiIntentInferenceEnabled = true;

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

const getSessionState = (userId) => {
  if (!sessionStateStore.has(userId)) {
    sessionStateStore.set(userId, {
      lastAddToCartPayload: null,
      lastSuggestions: [],
    });
  }

  return sessionStateStore.get(userId);
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
    const normalizedQuery = String(query || "").toLowerCase().trim();
    const tokens = normalizedQuery
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter((token) => token.length >= 3);

    const scored = docs
      .map((item) => {
        const haystack = buildSemanticText(item).toLowerCase();

        if (!tokens.length) {
          return { item, score: haystack.includes(normalizedQuery) ? 1 : 0 };
        }

        let score = 0;
        tokens.forEach((token) => {
          if (haystack.includes(token)) {
            score += 1;
          }
        });

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.item);

    return scored;
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

const extractQuantity = (text) => {
  const quantityMatch = text.match(/(?:\bfor\b|\bqty\b|\bquantity\b|\badd\b|\border\b)\s*(\d{1,2})\b/i);
  if (!quantityMatch) {
    return 1;
  }

  return Math.max(1, Math.min(10, Number(quantityMatch[1]) || 1));
};

const inferDishFromMessage = (message = "") => {
  const cleaned = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const stopWords = new Set([
    "order",
    "add",
    "best",
    "cheapest",
    "recommend",
    "show",
    "find",
    "me",
    "for",
    "under",
    "below",
    "within",
    "price",
    "with",
    "rating",
    "review",
    "reviews",
    "restaurant",
    "restaurants",
    "compare",
    "different",
    "spicy",
    "veg",
    "vegetarian",
    "please",
    "rs",
    "rupees",
  ]);

  const tokens = cleaned
    .split(" ")
    .filter((token) => token && !stopWords.has(token) && !/^\d+$/.test(token));

  if (!tokens.length) {
    return null;
  }

  return tokens.slice(0, 4).join(" ");
};

const messageWantsComparison = (message = "") => {
  return /(best|compare|comparison|different restaurants|cheapest|lowest price|top rated|rating|review)/i.test(
    message
  );
};

const isGreetingMessage = (message = "") => {
  const cleaned = String(message).trim().toLowerCase();
  return /^(hi|hello|hey|hii|yo|hola|namaste|good morning|good afternoon|good evening)$/.test(cleaned);
};

const messageWantsAddToCart = (message = "") => {
  return /(add(\s+\d+)?\s+(it\s+)?to\s+cart|add\s+to\s+cart|place\s+order|order\s+it|checkout)/i.test(message);
};

const compareDishAcrossRestaurants = async ({
  dish,
  limit = 8,
  budget,
  isVeg,
  spicy,
}) => {
  if (!dish || String(dish).trim().length < 2) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Please provide a dish/item name to compare");
  }

  const query = {
    isAvailable: true,
    name: { $regex: String(dish).trim(), $options: "i" },
  };

  if (typeof isVeg === "boolean" && isVeg) {
    query.isVeg = true;
  }

  if (budget) {
    query.price = { $lte: Number(budget) };
  }

  const candidates = await MenuItem.find(query)
    .populate("restaurant", "name rating ratingsCount estimatedWaitMinutes imageUrl")
    .sort({ price: 1, popularityScore: -1 })
    .limit(120);

  let normalizedCandidates = candidates;
  if (!normalizedCandidates.length) {
    // Fall back to semantic query to avoid hard failures when wording differs from menu naming.
    normalizedCandidates = await semanticSearchMenuItems({
      query: String(dish),
      limit: 40,
    });
  }

  const spicyFiltered = spicy
    ? normalizedCandidates.filter(
        (item) =>
          (item.tags || []).some((tag) => String(tag).toLowerCase().includes("spicy")) ||
          item.description?.toLowerCase().includes("spicy")
      )
    : normalizedCandidates;

  const bestPerRestaurant = new Map();

  spicyFiltered.forEach((item) => {
    const restaurantId = String(item.restaurant?._id || item.restaurant || "");
    if (!restaurantId) {
      return;
    }

    const existing = bestPerRestaurant.get(restaurantId);
    const itemName = String(item.name || "").toLowerCase();
    const dishText = String(dish).toLowerCase();
    const exactBoost = itemName === dishText ? 10 : itemName.includes(dishText) ? 5 : 0;
    const restaurantRating = Number(item.restaurant?.rating || 0);
    const ratingsCount = Number(item.restaurant?.ratingsCount || 0);
    const reviewBoost = Math.min(6, Math.log1p(ratingsCount));
    const valuePenalty = Number(item.price || 0) / 120;
    const score = restaurantRating * 8 + reviewBoost + exactBoost - valuePenalty;

    const candidate = {
      menuItemId: String(item._id),
      menuItemName: item.name,
      price: item.price,
      isVeg: Boolean(item.isVeg),
      restaurantId,
      restaurantName: item.restaurant?.name || "Restaurant",
      rating: Number((item.restaurant?.rating || 0).toFixed(1)),
      ratingsCount,
      etaMinutes: Number(item.restaurant?.estimatedWaitMinutes || 0),
      score: Number(score.toFixed(2)),
    };

    if (!existing || candidate.score > existing.score) {
      bestPerRestaurant.set(restaurantId, candidate);
    }
  });

  const ranked = [...bestPerRestaurant.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 8)));

  if (!ranked.length) {
    return {
      dish,
      comparedAt: new Date().toISOString(),
      options: [],
      best: null,
    };
  }

  const restaurantIds = ranked.map((item) => item.restaurantId);
  const recentReviews = await Review.find({ restaurant: { $in: restaurantIds } })
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(300);

  const firstReviewByRestaurant = new Map();
  recentReviews.forEach((review) => {
    const key = String(review.restaurant);
    if (!firstReviewByRestaurant.has(key)) {
      firstReviewByRestaurant.set(key, review);
    }
  });

  const options = ranked.map((item) => {
    const review = firstReviewByRestaurant.get(item.restaurantId);
    return {
      ...item,
      latestReview: review
        ? {
            rating: review.rating,
            comment: review.comment,
            author: review.user?.name || "Customer",
          }
        : null,
    };
  });

  return {
    dish,
    comparedAt: new Date().toISOString(),
    options,
    best: options[0],
  };
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
  if (!env.googleGeminiApiKey || !geminiIntentInferenceEnabled) {
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

  try {
    const raw = await generateContent(prompt);
    return extractJsonBlock(raw);
  } catch (error) {
    const errorText = String(error?.message || "").toLowerCase();
    if (error?.status === 429 || errorText.includes("quota exceeded") || errorText.includes("too many requests")) {
      geminiIntentInferenceEnabled = false;
      return null;
    }

    return null;
  }
};

const chatOrderAssistant = async ({ userId, message }) => {
  const memory = getMemory(userId);
  const sessionState = getSessionState(userId);
  addToMemory(userId, "user", message);

  if (isGreetingMessage(message)) {
    const greetingReply = sessionState.lastAddToCartPayload
      ? `Hi! I can continue with ${sessionState.lastAddToCartPayload.name} at Rs.${sessionState.lastAddToCartPayload.price}, or help you find something else.`
      : "Hi! Tell me what you want to eat and I will find the best options for you.";

    addToMemory(userId, "assistant", greetingReply);
    return {
      reply: greetingReply,
      actions: [],
      suggestions: sessionState.lastSuggestions || [],
      memory: getMemory(userId),
    };
  }

  if (messageWantsAddToCart(message) && sessionState.lastAddToCartPayload) {
    const requestedQuantity = extractQuantity(message);
    const quantity = requestedQuantity || sessionState.lastAddToCartPayload.quantity || 1;

    const payload = {
      ...sessionState.lastAddToCartPayload,
      quantity,
    };

    const addReply = `Done. I can add ${quantity} x ${payload.name} to your cart now.`;
    addToMemory(userId, "assistant", addReply);

    return {
      reply: addReply,
      actions: [
        {
          type: "add_to_cart",
          payload,
        },
      ],
      suggestions: sessionState.lastSuggestions || [],
      memory: getMemory(userId),
    };
  }

  let parsedIntent = {
    intent: "search",
    cuisine: null,
    dish: null,
    spicy: false,
    isVeg: false,
    budget: extractBudget(message),
    quantity: extractQuantity(message),
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
  const inferredDish = parsedIntent.dish || inferDishFromMessage(message);
  const wantsComparison = parsedIntent.intent === "compare" || messageWantsComparison(message);

  if (wantsComparison && inferredDish) {
    const comparison = await compareDishAcrossRestaurants({
      dish: inferredDish,
      budget: parsedIntent.budget,
      isVeg: parsedIntent.isVeg,
      spicy: parsedIntent.spicy,
      limit: 6,
    });

    if (!comparison.options.length) {
      const noCompareReply = `I could not find ${inferredDish} across multiple restaurants right now. Try another item or relax filters.`;
      addToMemory(userId, "assistant", noCompareReply);
      return {
        reply: noCompareReply,
        actions: [],
        suggestions: [],
        comparison,
        memory: getMemory(userId),
      };
    }

    const best = comparison.best;
    const optionsText = comparison.options
      .slice(0, 3)
      .map(
        (option, idx) =>
          `${idx + 1}. ${option.restaurantName} - ${option.menuItemName} (Rs.${option.price}, ${option.rating}★ from ${option.ratingsCount} reviews)`
      )
      .join(" ");

    const reply = `Best ${comparison.dish}: ${best.menuItemName} from ${best.restaurantName} at Rs.${best.price} (${best.rating}★, ${best.ratingsCount} reviews). ${optionsText}`;

    const actions = [
      {
        type: "add_to_cart",
        payload: {
          menuItemId: best.menuItemId,
          restaurantId: best.restaurantId,
          name: best.menuItemName,
          price: best.price,
          quantity: parsedIntent.quantity || 1,
        },
      },
    ];

    sessionState.lastAddToCartPayload = actions[0].payload;
    sessionState.lastSuggestions = comparison.options;

    addToMemory(userId, "assistant", reply);

    return {
      reply,
      actions,
      suggestions: comparison.options,
      comparison,
      memory: getMemory(userId),
    };
  }

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

  const candidatesBeforeDishFilter = [...candidates];

  if (parsedIntent.dish) {
    candidates = candidates.filter((item) => item.name.toLowerCase().includes(String(parsedIntent.dish).toLowerCase()));
  } else if (inferredDish) {
    candidates = candidates.filter((item) => item.name.toLowerCase().includes(String(inferredDish).toLowerCase()));
  }

  if (!candidates.length && candidatesBeforeDishFilter.length) {
    // Fall back to semantic options if the inferred dish text was too strict.
    candidates = candidatesBeforeDishFilter;
  }

  const topPick = candidates[0] || null;

  let assistantMessage = "I could not find a perfect match yet. Want me to broaden the search?";
  const actions = [];

  if (topPick) {
    const addToCartPayload = {
      menuItemId: String(topPick._id),
      restaurantId: String(topPick.restaurant?._id || topPick.restaurant),
      name: topPick.name,
      image: topPick.image?.url || "",
      price: topPick.price,
      quantity: parsedIntent.quantity || 1,
    };

    actions.push({
      type: "add_to_cart",
      payload: addToCartPayload,
    });

    sessionState.lastAddToCartPayload = addToCartPayload;
    sessionState.lastSuggestions = candidates.slice(0, 5);

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
  compareDishAcrossRestaurants,
  getCollaborativeRecommendations,
  getQuickReorderPrediction,
  chatOrderAssistant,
  streamAssistantResponse,
  ensureAiAccess,
};
