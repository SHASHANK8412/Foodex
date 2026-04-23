const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/foodex",
  jwtSecret: process.env.JWT_SECRET || "change_this_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID?.trim() || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || "",
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "",
  kafkaEnabled: process.env.KAFKA_ENABLED === "true",
  kafkaClientId: process.env.KAFKA_CLIENT_ID || "foodex-backend",
  kafkaBrokers: process.env.KAFKA_BROKERS || "localhost:9092",
  kafkaGroupId: process.env.KAFKA_GROUP_ID || "foodex-order-processors",
  analyticsOutputDir:
    process.env.ANALYTICS_OUTPUT_DIR || path.join(process.cwd(), "analytics", "output"),
};

module.exports = env;
