const pino = require("pino");

// Structured JSON logs (one object per line) so a log platform can index them;
// pretty-printed in development. Silent under Jest unless LOG_LEVEL is set.
const isTest = process.env.NODE_ENV === "test";
const isDevelopment = (process.env.NODE_ENV || "development") === "development";

const usePretty = isDevelopment && process.env.LOG_FORMAT !== "json";

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? "silent" : "info"),
  base: { service: "foodex-api" },
  // Never write credentials or tokens to logs.
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.razorpaySignature"],
    censor: "[redacted]",
  },
  ...(usePretty
    ? { transport: { target: "pino-pretty", options: { colorize: true, singleLine: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" } } }
    : {}),
});

module.exports = logger;
