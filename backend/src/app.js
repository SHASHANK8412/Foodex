const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const RedisStoreImport = require("rate-limit-redis");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const redisClient = require("./config/redis");
const routes = require("./routes");
const { redisQueueEnabled, emailQueue, smsQueue, pushNotificationQueue, analyticsQueue } = require("./queues");

const RedisStore = RedisStoreImport.default || RedisStoreImport;

const app = express();

const isAllowedClientOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (env.clientOrigins.includes(origin)) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    ) &&
      ["5173", "5174"].includes(parsed.port);
  } catch (_error) {
    return false;
  }
};

// Bull Board UI (optional, avoid boot failures in test/minimal envs)
try {
  if (redisQueueEnabled) {
    const { Server } = require("bull-board");
    let BullAdapter;
    try {
      ({ BullAdapter } = require("bull-board/bullAdapter"));
    } catch (_error) {
      ({ BullAdapter } = require("bull-board/dist/src/app/bullAdapter"));
    }

    const serverAdapter = new Server({
      prefix: "/admin/queues",
      queues: [
        new BullAdapter(emailQueue),
        new BullAdapter(smsQueue),
        new BullAdapter(pushNotificationQueue),
        new BullAdapter(analyticsQueue),
      ],
    });
    serverAdapter.setBasePath("/admin/queues");
    app.use("/admin/queues", serverAdapter.getRouter());
  }
} catch (_error) {
  // Queue dashboard is optional in environments where adapter paths differ.
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedClientOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use("/api/orders/razorpay/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// Rate limiting
const limiterOptions = {
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
};

if (env.nodeEnv !== "test" && env.redisEnabled) {
  limiterOptions.store = new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  });
}

const limiter = rateLimit(limiterOptions);

app.use("/api", limiter);

app.use("/api", routes);

module.exports = app;
