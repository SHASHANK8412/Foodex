# Foodex

Full-stack food delivery platform built with React + Vite, Node.js + Express, and MongoDB.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Redux Toolkit, Socket.io client
- Backend: Node.js, Express, Mongoose, Socket.io, JWT auth
- Database: MongoDB
- AI: Gemini API for natural-language ordering
- Payments: Razorpay

## Project Structure

- frontend: React app (customer/admin/delivery dashboards, AI order box)
- backend: API server (auth, restaurants, menu, orders, payments, tracking, analytics)

## Quick Start

1. Start MongoDB locally.
2. Backend setup:
	- cd backend
	- npm install
	- Copy .env.example to .env and fill required values.
	- npm run seed:demo
	- npm run dev
3. Frontend setup:
	- cd ../frontend
	- npm install
	- npm run dev

Frontend runs on http://localhost:5173
Backend runs on http://localhost:5000

## Key Features Implemented

- JWT authentication and role-based access control
- Restaurant browsing, menu browsing, cart, checkout, order history
- Real-time order tracking with status timeline and socket updates
- Razorpay payment order and verification flow
- Admin analytics and menu/restaurant management
- Gemini-powered AI Order Box with database-backed recommendations