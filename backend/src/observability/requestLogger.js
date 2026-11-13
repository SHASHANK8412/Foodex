const crypto = require("crypto");
const pinoHttp = require("pino-http");
const logger = require("./logger");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

// Gives every request an id (reusing a well-formed incoming X-Request-Id, e.g.
// from a load balancer), returns it in the response header, and logs one line
// per request with that id. Errors logged later carry the same id via req.log.
const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Health checks and metrics scrapes would drown out real traffic.
  autoLogging: { ignore: (req) => req.url.startsWith("/api/health") || req.url === "/metrics" },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = requestLogger;
