const mongoose = require("mongoose");
const env = require("../config/env");
const redisClient = require("../config/redis");

const MONGO_STATES = ["disconnected", "connected", "connecting", "disconnecting"];
const CHECK_TIMEOUT_MS = 1500;

const withTimeout = (promise) => {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), CHECK_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const timed = async (check) => {
  const started = Date.now();
  try {
    const detail = await withTimeout(check());
    return { status: "up", latencyMs: Date.now() - started, ...(detail || {}) };
  } catch (error) {
    return { status: "down", latencyMs: Date.now() - started, error: error.message };
  }
};

const checkMongo = () =>
  timed(async () => {
    if (mongoose.connection.readyState !== 1) {
      throw new Error(MONGO_STATES[mongoose.connection.readyState] || "not connected");
    }
    await mongoose.connection.db.admin().ping();
  });

const checkRedis = () =>
  env.redisEnabled
    ? timed(async () => {
        const reply = await redisClient.call("PING");
        if (reply !== "PONG") throw new Error(`unexpected reply ${reply}`);
      })
    : Promise.resolve({ status: "disabled" });

const checkKafka = async () => {
  if (!env.kafkaEnabled) {
    return { status: "disabled", transport: "in-process" };
  }
  // Required lazily: the Kafka module loads services that need the models.
  const { getKafkaStatus } = require("../kafka");
  const status = await getKafkaStatus();
  // Without a broker events are handled in-process, so an outage degrades the
  // service instead of taking it down.
  return { status: status.connected ? "up" : "degraded", transport: status.transport };
};

// Liveness: the process is running and the event loop responds.
const liveness = () => ({
  status: "ok",
  uptimeSeconds: Math.round(process.uptime()),
  timestamp: new Date().toISOString(),
});

// Readiness: the dependencies needed to serve traffic are reachable.
// MongoDB and (when enabled) Redis are required; Kafka only degrades.
const readiness = async () => {
  const [mongo, redis, kafka] = await Promise.all([checkMongo(), checkRedis(), checkKafka()]);
  const required = [mongo, redis].filter((check) => check.status !== "disabled");
  const ready = required.every((check) => check.status === "up");

  return {
    status: ready ? (kafka.status === "degraded" ? "degraded" : "ok") : "unavailable",
    ready,
    checks: { mongo, redis, kafka },
    version: process.env.APP_VERSION || process.env.npm_package_version || "dev",
    timestamp: new Date().toISOString(),
  };
};

module.exports = { liveness, readiness };
