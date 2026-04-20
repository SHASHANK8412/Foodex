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
- Apache Kafka event-driven workflow for order processing and notifications
- Apache Spark analytics integration for recommendations, demand prediction, and delivery ETA

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

## Kafka Event-Driven Flow

When Kafka is enabled (`KAFKA_ENABLED=true`), order processing uses producers and consumers:

1. API creates an order and publishes `foodex.order.created`
2. Kafka consumer triggers notification handling for order creation
3. Kafka consumer attempts delivery partner assignment and emits `foodex.delivery.assigned`
4. Payment verification publishes `foodex.order.paid`
5. Kafka consumer sends payment success notifications and retries delivery assignment if pending

### Kafka Topics

- `foodex.order.created`
- `foodex.order.paid`
- `foodex.delivery.assigned`
- `foodex.notification.requested`

### Kafka Environment Variables

- `KAFKA_ENABLED=true|false`
- `KAFKA_CLIENT_ID=foodex-backend`
- `KAFKA_BROKERS=localhost:9092`
- `KAFKA_GROUP_ID=foodex-order-processors`

## Spark Analytics Integration

Spark-generated features are served through analytics APIs and consumed by the MERN frontend.

### Analytics Endpoints

- `GET /api/analytics/recommendations` (auth required)
- `GET /api/analytics/demand/:restaurantId`
- `GET /api/analytics/delivery-estimate?distanceKm=4&itemCount=2&hourOfDay=18`

### Analytics Environment Variable

- `ANALYTICS_OUTPUT_DIR=./analytics/output`

### Gemini AI Environment Variables

- `GOOGLE_GEMINI_API_KEY=...`
- `GOOGLE_GEMINI_MODEL=gemini-2.0-flash`

### Spark Pipeline

Run the Spark feature job from `backend/analytics/`:

```bash
spark-submit analytics/spark_foodex_features.py --input analytics/sample/orders.json --output analytics/output --format json
```

Output files used by backend service:

- `recommendations.json`
- `demand_forecast.json`
- `delivery_eta_model.json`

If files are not present, backend falls back to MongoDB aggregate/heuristic calculations.

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
