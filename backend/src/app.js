const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const RedisStoreImport = require("rate-limit-redis");
const cookieParser = require("cookie-parser");

const { StatusCodes } = require("http-status-codes");
const env = require("./config/env");
const ApiError = require("./utils/ApiError");
const redisClient = require("./config/redis");
const routes = require("./routes");
const requestLogger = require("./observability/requestLogger");
const { httpMetricsMiddleware, register: metricsRegister } = require("./observability/metrics");
const { redisQueueEnabled, emailQueue, smsQueue, pushNotificationQueue, analyticsQueue } = require("./queues");

const RedisStore = RedisStoreImport.default || RedisStoreImport;

const app = express();
// Trust one proxy hop (nginx in the Docker image) for client IPs and protocol.
app.set("trust proxy", 1);

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
// Allowed: the configured client origins, and the API's own origin (the Swagger
// UI at /api/docs, or the web app when nginx serves both on one host).
app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const sameOrigin = origin && origin === `${req.protocol}://${req.get("host")}`;

    if (sameOrigin || isAllowedClientOrigin(origin)) {
      callback(null, { origin: true, credentials: true });
      return;
    }

    callback(new ApiError(StatusCodes.FORBIDDEN, `Origin not allowed: ${origin}`));
  })
);

app.use("/api/orders/razorpay/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
app.use(httpMetricsMiddleware);

// Prometheus scrape endpoint. Set METRICS_TOKEN to require a bearer token.
app.get("/metrics", async (req, res) => {
  if (env.metricsToken && req.headers.authorization !== `Bearer ${env.metricsToken}`) {
    return res.status(401).end();
  }
  res.set("Content-Type", metricsRegister.contentType);
  return res.send(await metricsRegister.metrics());
});

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
