const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const defaultClientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const extraClientOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL_ALLOWLIST || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const clientOrigins = Array.from(
  new Set([
    defaultClientUrl,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    ...extraClientOrigins,
  ])
);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  clientUrl: defaultClientUrl,
  clientOrigins,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/foodex",
  jwtSecret: process.env.JWT_SECRET || "change_this_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  googleGeminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || "",
  googleGeminiModel: process.env.GOOGLE_GEMINI_MODEL || "gemini-2.0-flash",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-ada-002",
  pineconeApiKey: process.env.PINECONE_API_KEY || "",
  pineconeIndex: process.env.PINECONE_INDEX || "",
  useAtlasVectorSearch: process.env.USE_ATLAS_VECTOR_SEARCH === "true",
  kafkaEnabled: process.env.KAFKA_ENABLED === "true",
  kafkaClientId: process.env.KAFKA_CLIENT_ID || "foodex-backend",
  kafkaBrokers: process.env.KAFKA_BROKERS || "localhost:9092",
  kafkaGroupId: process.env.KAFKA_GROUP_ID || "foodex-order-processors",
  analyticsOutputDir:
    process.env.ANALYTICS_OUTPUT_DIR || path.join(process.cwd(), "analytics", "output"),
  redisEnabled: process.env.REDIS_ENABLED === "true",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN || "",
  maptilerApiKey: process.env.MAPTILER_API_KEY || process.env.MAP_TILE_API_KEY || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  graphqlPath: process.env.GRAPHQL_PATH || "/graphql",
  graphqlPersistedSecret: process.env.GRAPHQL_PERSISTED_SECRET || "foodex-persisted-secret",
};

module.exports = env;
