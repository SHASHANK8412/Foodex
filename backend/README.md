# Foodex Backend

Production-oriented Node.js + Express backend for food delivery with MongoDB, JWT auth, RBAC, Razorpay payment integration, and Socket.io real-time order tracking.

## Features

- JWT authentication (register/login/me)
- Role-based access control (`user`, `admin`, `delivery`)
- Restaurant and menu management
- Order placement and status lifecycle
- Razorpay payment order creation and verification
- Delivery partner creation and assignment
- Real-time order updates and live delivery location events via Socket.io
- Apache Kafka event bus for orders, payments, delivery and clickstream, with retries and a dead-letter topic
- Apache Spark (Structured Streaming and MLlib) for live metrics, recommendations, segments, demand and delivery ETA

## Folder Structure

```text
src/
  app.js
  server.js
  config/
  constants/
  controllers/
  middlewares/
  models/
  routes/
  services/
  sockets/
  utils/
  validators/
```

## Setup

1. Install packages:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Run development server:

```bash
npm run dev
```

4. Seed demo users, restaurants, and menu:

```bash
npm run seed:demo
```

Demo credentials:

- admin@foodex.com / admin123
- owner.indian@foodex.com / owner123
- owner.chinese@foodex.com / owner123
- owner.italian@foodex.com / owner123
- user@foodex.com / user123

## API Base URL

`/api`

## Event bus (Kafka)

Domain events are published through `src/kafka/`. With `KAFKA_ENABLED=true` they go to
Kafka; otherwise the same handlers run inside the API process, so behaviour is the same
either way.

1. Creating an order publishes `foodex.order.created` (with the order lines), keyed by order id
2. A consumer group sends the notification and assigns a delivery partner, publishing `foodex.delivery.assigned`
3. Payment verification (or the Razorpay webhook) publishes `foodex.order.paid`
4. Every status change publishes `foodex.order.status`, including the delivery time once delivered
5. Browser events posted to `POST /api/events` are published to `foodex.clickstream`
6. Spark Structured Streaming publishes windowed metrics to `foodex.analytics.realtime`, which the API consumes and pushes to admins over Socket.io (`pipeline:realtime`)

Delivery is at-least-once: handlers are retried (`KAFKA_CONSUMER_MAX_RETRIES`), events that
keep failing or cannot be parsed go to `foodex.dlq`, and redelivered events are skipped by `eventId`.

### Kafka environment variables

- `KAFKA_ENABLED=true|false`
- `KAFKA_CLIENT_ID=foodex-backend`
- `KAFKA_BROKERS=localhost:9092`
- `KAFKA_GROUP_ID=foodex-order-processors`
- `KAFKA_TOPIC_PARTITIONS=3`, `KAFKA_REPLICATION_FACTOR=1`, `KAFKA_CONSUMER_MAX_RETRIES=3`

## Spark analytics

The Spark jobs live in `analytics/` (see `analytics/README.md`). The API serves their output
from `ANALYTICS_OUTPUT_DIR` and falls back to MongoDB aggregates when a dataset is missing;
each response says which source answered.

- `GET /api/analytics/recommendations` (auth required): ALS recommendations
- `GET /api/analytics/demand/:restaurantId`: expected orders per hour
- `GET /api/analytics/delivery-estimate?distanceKm=4&itemCount=2&hourOfDay=18`: regression model
- `GET /api/pipeline/status`, `/realtime`, `/insights` (admin): pipeline state, live windows, batch insights
- `POST /api/pipeline/simulate` (admin): publish simulated traffic through the event bus

Scripts:

- `npm run analytics:export`: write orders and the catalogue from MongoDB to `analytics/data/`
- `npm run kafka:load -- --orders 20000`: publish synthetic events through the event bus

Environment: `ANALYTICS_OUTPUT_DIR`, `ANALYTICS_DATA_DIR`, `ANALYTICS_LAKE_DIR` (defaults under `./analytics`).

### Gemini AI environment variables

- `GOOGLE_GEMINI_API_KEY=...`
- `GOOGLE_GEMINI_MODEL=gemini-2.0-flash`

## Key Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/restaurants`
- `POST /api/restaurants` (admin)
- `POST /api/restaurants/:restaurantId/menu` (admin)
- `POST /api/ai/chat` (Gemini-backed natural-language order assistant)
- `POST /api/ai/semantic-search`
- `GET /api/ai/recommendations`
- `POST /api/orders` (user)
- `POST /api/orders/verify-payment` (user)
- `GET /api/orders/:orderId/payment-status` (user/admin/delivery with access)
- `PATCH /api/orders/:orderId/status` (admin/delivery)
- `PATCH /api/orders/:orderId/assign-delivery` (admin)
- `GET /api/owner/orders` (owner/admin)
- `PATCH /api/owner/orders/:orderId/status` (owner/admin)
- `GET /api/owner/orders/:orderId/invoice` (owner/admin)
- `GET /api/owner/orders/:orderId/invoice/pdf` (owner/admin)
- `GET /api/delivery/partners` (admin)
- `POST /api/delivery/partners` (admin)
- `GET /api/admin/payments/dashboard` (admin)

## Socket Events

Client emits:
- `order:join` with `{ orderId }`
- `order:leave` with `{ orderId }`
- `delivery:location` with `{ orderId, location: { lat, lng } }`

Server emits:
- `order:update`
- `delivery:location`

## Production Notes

- Replace `JWT_SECRET` with a strong secret in production.
- Configure real Razorpay keys for live payment flow.
- Register at least one admin user manually in DB or via seed process.
- Add centralized logging/monitoring (Winston + OpenTelemetry/Sentry) for production operations.
