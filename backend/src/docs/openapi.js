// OpenAPI 3.1 description of the public REST API, served at /api/docs.
// GraphQL (/graphql) and Socket.io events are described in the README.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const ok = (schema, description = "OK") => ({
  description,
  content: { "application/json": { schema: { type: "object", properties: { success: { const: true }, data: schema } } } },
});
const errors = (...codes) =>
  Object.fromEntries(codes.map((code) => [code, { $ref: `#/components/responses/E${code}` }]));
const body = (schema) => ({ required: true, content: { "application/json": { schema } } });
const idParam = (name) => ({ name, in: "path", required: true, schema: ref("ObjectId") });
const bearer = [{ bearerAuth: [] }];

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Foodex API",
    version: "1.0.0",
    description:
      "REST API for the Foodex food delivery platform. Authenticate with `POST /auth/login`, then send the token as `Authorization: Bearer <token>`. Every response carries an `X-Request-Id` header; quote it when reporting a problem.",
  },
  servers: [{ url: "/api" }],
  tags: [
    { name: "Auth" },
    { name: "Restaurants" },
    { name: "Pricing", description: "Server-side pricing and coupons" },
    { name: "Orders" },
    { name: "Delivery", description: "Delivery partner endpoints" },
    { name: "Analytics", description: "Features built by the Spark batch job, with MongoDB fallbacks" },
    { name: "Events", description: "Clickstream ingestion into Kafka" },
    { name: "Pipeline", description: "Admin: Kafka and Spark pipeline status" },
    { name: "Health" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      ObjectId: { type: "string", pattern: "^[a-f0-9]{24}$", examples: ["69df88daf34a4c79a40bf3ef"] },
      Error: {
        type: "object",
        properties: {
          success: { const: false },
          message: { type: "string" },
          details: { type: ["array", "null"], items: { type: "object" } },
          requestId: { type: "string" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: ref("ObjectId"),
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { enum: ["user", "owner", "delivery", "admin"] },
          phone: { type: "string" },
        },
      },
      AuthResult: { type: "object", properties: { token: { type: "string" }, user: ref("User") } },
      Restaurant: {
        type: "object",
        properties: {
          _id: ref("ObjectId"),
          name: { type: "string" },
          cuisine: { type: "array", items: { type: "string" } },
          isOpen: { type: "boolean" },
          rating: { type: "number" },
          demandLevel: { enum: ["low", "medium", "high"] },
          estimatedWaitMinutes: { type: "integer" },
          address: { type: "object" },
        },
      },
      CartLine: {
        type: "object",
        required: ["menuItemId", "quantity"],
        properties: { menuItemId: ref("ObjectId"), quantity: { type: "integer", minimum: 1, maximum: 50 } },
      },
      QuoteRequest: {
        type: "object",
        required: ["restaurantId", "items"],
        properties: {
          restaurantId: ref("ObjectId"),
          items: { type: "array", minItems: 1, maxItems: 50, items: ref("CartLine") },
          couponCode: { type: "string", examples: ["FOODEX30"] },
        },
      },
      Quote: {
        type: "object",
        properties: {
          restaurantId: ref("ObjectId"),
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                menuItemId: ref("ObjectId"),
                name: { type: "string" },
                quantity: { type: "integer" },
                price: { type: "number" },
                lineTotal: { type: "number" },
              },
            },
          },
          subtotal: { type: "number" },
          discount: { type: "number" },
          deliveryFee: { type: "number" },
          taxAmount: { type: "number" },
          totalAmount: { type: "number" },
          taxRate: { type: "number" },
          coupon: {
            type: ["object", "null"],
            properties: {
              code: { type: "string" },
              valid: { type: "boolean" },
              reason: { type: "string", description: "Why the coupon does not apply" },
              title: { type: "string" },
              savings: { type: "number" },
            },
          },
        },
      },
      Address: {
        type: "object",
        required: ["line1", "city", "state", "postalCode"],
        properties: {
          line1: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          postalCode: { type: "string" },
          location: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } } },
        },
      },
      Order: {
        type: "object",
        properties: {
          _id: ref("ObjectId"),
          shortId: { type: "string" },
          status: { enum: ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] },
          paymentStatus: { enum: ["pending", "paid", "failed", "refunded"] },
          items: { type: "array", items: { type: "object" } },
          subtotal: { type: "number" },
          couponCode: { type: "string" },
          discountAmount: { type: "number" },
          taxAmount: { type: "number" },
          deliveryFee: { type: "number" },
          totalAmount: { type: "number" },
          deliveryAddress: ref("Address"),
          trackingEvents: { type: "array", items: { type: "object" } },
        },
      },
    },
    responses: {
      E400: { description: "Invalid request", content: { "application/json": { schema: ref("Error") } } },
      E401: { description: "Missing or invalid token", content: { "application/json": { schema: ref("Error") } } },
      E403: { description: "Not allowed for this user", content: { "application/json": { schema: ref("Error") } } },
      E404: { description: "Not found", content: { "application/json": { schema: ref("Error") } } },
      E409: { description: "Conflict", content: { "application/json": { schema: ref("Error") } } },
      E429: { description: "Rate limited", content: { "application/json": { schema: ref("Error") } } },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create a customer account",
        requestBody: body({
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
            phone: { type: "string" },
          },
        }),
        responses: { 201: ok(ref("AuthResult"), "Created"), ...errors(400, 409, 429) },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with email and password",
        description: "Rate limited to 10 failed attempts per 15 minutes per IP and email.",
        requestBody: body({
          type: "object",
          required: ["email", "password"],
          properties: { email: { type: "string", format: "email", examples: ["user@foodex.com"] }, password: { type: "string" } },
        }),
        responses: { 200: ok(ref("AuthResult")), ...errors(400, 401, 429) },
      },
    },
    "/auth/me": {
      get: { tags: ["Auth"], summary: "The signed-in user", security: bearer, responses: { 200: ok(ref("User")), ...errors(401) } },
    },
    "/restaurants": {
      get: {
        tags: ["Restaurants"],
        summary: "List restaurants",
        responses: { 200: ok({ type: "array", items: ref("Restaurant") }) },
      },
    },
    "/restaurants/{restaurantId}": {
      get: {
        tags: ["Restaurants"],
        summary: "A restaurant and its menu",
        parameters: [idParam("restaurantId")],
        responses: {
          200: ok({ type: "object", properties: { restaurant: ref("Restaurant"), menu: { type: "array", items: { type: "object" } } } }),
          ...errors(404),
        },
      },
    },
    "/pricing/quote": {
      post: {
        tags: ["Pricing"],
        summary: "Price a cart",
        description:
          "Prices come from the database and coupons are validated here; checkout and order creation use the same calculation, so the quoted total is what is charged. An invalid coupon is reported in `coupon.reason`, not as an error. Works without a token; coupons limited to first orders need one.",
        requestBody: body(ref("QuoteRequest")),
        responses: { 200: ok(ref("Quote")), ...errors(400) },
      },
    },
    "/pricing/offers": {
      get: {
        tags: ["Pricing"],
        summary: "Coupons and restaurant promotions valid right now",
        responses: {
          200: ok({
            type: "array",
            items: {
              type: "object",
              properties: { code: { type: "string" }, title: { type: "string" }, sub: { type: "string" }, source: { enum: ["platform", "restaurant"] } },
            },
          }),
        },
      },
    },
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "Orders visible to the caller",
        description: "Customers see their own orders, delivery partners the orders assigned to them, admins all orders.",
        security: bearer,
        responses: { 200: ok({ type: "array", items: ref("Order") }), ...errors(401) },
      },
      post: {
        tags: ["Orders"],
        summary: "Place an order",
        description: "Creates the order and a Razorpay payment order, and publishes `foodex.order.created`. Rejects a coupon that no longer applies.",
        security: bearer,
        requestBody: body({
          allOf: [ref("QuoteRequest"), { type: "object", required: ["deliveryAddress"], properties: { deliveryAddress: ref("Address") } }],
        }),
        responses: {
          201: ok(
            {
              type: "object",
              properties: {
                order: ref("Order"),
                payment: {
                  type: "object",
                  properties: { keyId: { type: "string" }, razorpayOrderId: { type: "string" }, amount: { type: "integer", description: "In paise" }, isMock: { type: "boolean" } },
                },
              },
            },
            "Created"
          ),
          ...errors(400, 401),
        },
      },
    },
    "/orders/verify-payment": {
      post: {
        tags: ["Orders"],
        summary: "Verify a Razorpay payment signature",
        description: "Marks the order paid and publishes `foodex.order.paid`, which triggers rider assignment.",
        security: bearer,
        requestBody: body({
          type: "object",
          required: ["orderId", "razorpayOrderId", "razorpayPaymentId", "razorpaySignature"],
          properties: {
            orderId: ref("ObjectId"),
            razorpayOrderId: { type: "string" },
            razorpayPaymentId: { type: "string" },
            razorpaySignature: { type: "string" },
          },
        }),
        responses: { 200: ok(ref("Order")), ...errors(400, 401, 404, 409) },
      },
    },
    "/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "One order",
        security: bearer,
        parameters: [idParam("orderId")],
        responses: { 200: ok(ref("Order")), ...errors(401, 403, 404) },
      },
    },
    "/orders/{orderId}/status": {
      patch: {
        tags: ["Orders"],
        summary: "Move an order through its lifecycle",
        description:
          "Admins may make any allowed transition. Delivery partners may only mark their own assigned orders `out_for_delivery` or `delivered`.",
        security: bearer,
        parameters: [idParam("orderId")],
        requestBody: body({
          type: "object",
          required: ["status"],
          properties: { status: { enum: ["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] }, note: { type: "string" } },
        }),
        responses: { 200: ok(ref("Order")), ...errors(400, 401, 403, 404) },
      },
    },
    "/delivery/me": {
      get: {
        tags: ["Delivery"],
        summary: "The signed-in rider's profile",
        security: bearer,
        responses: { 200: ok({ type: "object", properties: { name: { type: "string" }, isAvailable: { type: "boolean" } } }), ...errors(401, 403) },
      },
    },
    "/delivery/availability": {
      put: {
        tags: ["Delivery"],
        summary: "Go available or offline",
        description: "Available riders are preferred when orders are assigned; among them, the one with the fewest active deliveries wins.",
        security: bearer,
        requestBody: body({ type: "object", required: ["isAvailable"], properties: { isAvailable: { type: "boolean" } } }),
        responses: { 200: ok({ type: "object", properties: { isAvailable: { type: "boolean" } } }), ...errors(401, 403) },
      },
    },
    "/analytics/recommendations": {
      get: {
        tags: ["Analytics"],
        summary: "Restaurants recommended for the caller",
        description: "ALS collaborative filtering from the Spark batch job; falls back to the caller's most-ordered restaurants. `source` says which.",
        security: bearer,
        responses: { 200: ok({ type: "array", items: { type: "object" } }), ...errors(401) },
      },
    },
    "/analytics/frequently-bought-together": {
      get: {
        tags: ["Analytics"],
        summary: "Dishes to suggest alongside a cart",
        description: "FP-Growth association rules from Spark when they match the menu, otherwise co-occurrence in past orders.",
        parameters: [
          { name: "restaurantId", in: "query", required: true, schema: ref("ObjectId") },
          { name: "menuItemIds", in: "query", required: true, schema: { type: "string" }, description: "Comma-separated ids in the cart" },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 6, default: 3 } },
        ],
        responses: {
          200: ok({
            type: "object",
            properties: { source: { enum: ["spark_fp_growth", "fallback_cooccurrence", "none"] }, suggestions: { type: "array", items: { type: "object" } } },
          }),
        },
      },
    },
    "/analytics/demand/{restaurantId}": {
      get: {
        tags: ["Analytics"],
        summary: "Expected orders per hour of day",
        parameters: [idParam("restaurantId")],
        responses: { 200: ok({ type: "object" }) },
      },
    },
    "/analytics/delivery-estimate": {
      get: {
        tags: ["Analytics"],
        summary: "Predicted delivery minutes",
        description: "Scores the Spark linear-regression model's exported coefficients; a heuristic when the model is absent.",
        parameters: [
          { name: "distanceKm", in: "query", schema: { type: "number", default: 4 } },
          { name: "itemCount", in: "query", schema: { type: "integer", default: 2 } },
          { name: "hourOfDay", in: "query", schema: { type: "integer", minimum: 0, maximum: 23 } },
        ],
        responses: { 200: ok({ type: "object", properties: { estimatedMinutes: { type: "integer" }, source: { type: "string" } } }) },
      },
    },
    "/events": {
      post: {
        tags: ["Events"],
        summary: "Ingest clickstream events",
        description: "Publishes up to 50 whitelisted browser events to the Kafka `foodex.clickstream` topic. A token is optional.",
        requestBody: body({
          type: "object",
          required: ["sessionId", "events"],
          properties: {
            sessionId: { type: "string" },
            events: {
              type: "array",
              maxItems: 50,
              items: {
                type: "object",
                required: ["action"],
                properties: { action: { enum: ["page_view", "restaurant_view", "add_to_cart", "remove_from_cart", "search", "checkout_started"] } },
              },
            },
          },
        }),
        responses: {
          202: ok({ type: "object", properties: { accepted: { type: "integer" }, transport: { enum: ["kafka", "in-process", "none"] } } }, "Accepted"),
          ...errors(400),
        },
      },
    },
    "/pipeline/status": {
      get: { tags: ["Pipeline"], summary: "Kafka, streaming, lake and batch status", security: bearer, responses: { 200: ok({ type: "object" }), ...errors(401, 403) } },
    },
    "/pipeline/realtime": {
      get: { tags: ["Pipeline"], summary: "Live one-minute windows", security: bearer, responses: { 200: ok({ type: "object" }), ...errors(401, 403) } },
    },
    "/pipeline/insights": {
      get: { tags: ["Pipeline"], summary: "Spark batch insights", security: bearer, responses: { 200: ok({ type: "object" }), ...errors(401, 403) } },
    },
    "/pipeline/simulate": {
      post: {
        tags: ["Pipeline"],
        summary: "Publish simulated traffic through the event bus",
        security: bearer,
        requestBody: body({ type: "object", properties: { orders: { type: "integer", minimum: 1, maximum: 500 } } }),
        responses: { 202: ok({ type: "object" }, "Accepted"), ...errors(400, 401, 403) },
      },
    },
    "/health/live": {
      get: { tags: ["Health"], summary: "Liveness", responses: { 200: { description: "The process is up" } } },
    },
    "/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness",
        description: "Checks MongoDB and (when enabled) Redis and Kafka. 503 when a required dependency is down; `degraded` when only Kafka is.",
        responses: { 200: { description: "Ready" }, 503: { description: "Not ready" } },
      },
    },
  },
};

module.exports = spec;
