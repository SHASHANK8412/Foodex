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

## API Base URL

`/api`

## Key Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/restaurants`
- `POST /api/restaurants` (admin)
- `POST /api/restaurants/:restaurantId/menu` (admin)
- `POST /api/orders` (user)
- `POST /api/orders/verify-payment` (user)
- `PATCH /api/orders/:orderId/status` (admin/delivery)
- `PATCH /api/orders/:orderId/assign-delivery` (admin)
- `GET /api/delivery/partners` (admin)
- `POST /api/delivery/partners` (admin)

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
