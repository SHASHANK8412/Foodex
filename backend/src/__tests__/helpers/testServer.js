// Integration-test harness: the real Express app on a throwaway in-memory MongoDB.
//
// Payment and notification providers are switched off so nothing leaves the
// machine: with no Razorpay keys the API issues mock payment orders, which is
// the same path the app uses in local development without keys.
process.env.NODE_ENV = "test";
process.env.KAFKA_ENABLED = "false";
process.env.REDIS_ENABLED = "false";
process.env.RAZORPAY_KEY_ID = "";
process.env.RAZORPAY_KEY_SECRET = "";
process.env.FIREBASE_SERVICE_ACCOUNT = "";
process.env.GOOGLE_GEMINI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.GROQ_API_KEY = "";
process.env.AGENT_LLM_PROVIDER = "rules";
process.env.ANALYTICS_OUTPUT_DIR = require("path").join(require("os").tmpdir(), "foodex-test-no-spark-output");
process.env.MAPTILER_API_KEY = "";
process.env.JWT_SECRET = "integration-test-secret-that-is-long-enough";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { notFound, errorHandler } = require("../../middlewares/errorMiddleware");

let mongo = null;
let app = null;

const start = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "foodex-test" });

  app = require("../../app");
  // server.js adds these after mounting GraphQL; the test app has no GraphQL.
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

const stop = async () => {
  await mongoose.disconnect();
  await mongo?.stop();
};

const clearDatabase = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

module.exports = { start, stop, clearDatabase };
