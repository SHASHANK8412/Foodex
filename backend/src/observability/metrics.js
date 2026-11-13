const client = require("prom-client");

// Prometheus metrics, served at GET /metrics.
const register = new client.Registry();
register.setDefaultLabels({ service: "foodex-api" });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency by route",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const ordersCreated = new client.Counter({
  name: "foodex_orders_created_total",
  help: "Orders created",
  labelNames: ["coupon"],
  registers: [register],
});

const orderValue = new client.Histogram({
  name: "foodex_order_value_rupees",
  help: "Order total in rupees",
  buckets: [100, 200, 300, 500, 750, 1000, 1500, 2500, 5000],
  registers: [register],
});

const paymentsVerified = new client.Counter({
  name: "foodex_payments_total",
  help: "Payment verification outcomes",
  labelNames: ["outcome", "source"],
  registers: [register],
});

const eventsPublished = new client.Counter({
  name: "foodex_events_published_total",
  help: "Domain events published to the event bus",
  labelNames: ["topic", "transport"],
  registers: [register],
});

const eventsDeadLettered = new client.Counter({
  name: "foodex_events_dead_lettered_total",
  help: "Events that failed processing and were dead-lettered",
  labelNames: ["topic"],
  registers: [register],
});

// The route pattern (/api/orders/:orderId), not the raw URL, keeps the label
// set small; unmatched requests are grouped as "unmatched".
const routeLabel = (req) => {
  if (req.route?.path) {
    return `${req.baseUrl || ""}${req.route.path}`;
  }
  return "unmatched";
};

const httpMetricsMiddleware = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: routeLabel(req), status_code: res.statusCode });
  });
  next();
};

module.exports = {
  register,
  httpMetricsMiddleware,
  ordersCreated,
  orderValue,
  paymentsVerified,
  eventsPublished,
  eventsDeadLettered,
};
