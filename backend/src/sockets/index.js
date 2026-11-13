const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const redisClient = require("../config/redis");
const { setIO } = require("./socketManager");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");

const socketAllowedOrigins = env.clientOrigins;

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: socketAllowedOrigins,
      credentials: true,
    },
  });

  // Redis adapter for multi-instance scaling (optional in local/dev)
  if (env.redisEnabled) {
    const pubClient = redisClient;
    const subClient = pubClient.duplicate();
    pubClient.on("error", () => undefined);
    subClient.on("error", () => undefined);
    io.adapter(createAdapter(pubClient, subClient));
  }

  setIO(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(" ")[1];
      if (!token) {
        return next(new Error("Unauthorized socket connection"));
      }

      const decoded = jwt.verify(token, env.jwtSecret);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized socket connection"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.userId}`);
    socket.join(`role:${socket.user.role}`);

    socket.on("order:join", async ({ orderId } = {}) => {
      if (orderId && mongoose.isValidObjectId(orderId)) {
        try {
          const order = await Order.findById(orderId)
            .populate("restaurant", "name address.location")
            .populate("user", "name email")
            .populate("deliveryPartner", "name phone");

          if (!order) {
            return;
          }

          const isAdmin = socket.user.role === "admin";
          const isOwner = String(order.user?._id || order.user) === String(socket.user.userId);
          const isDelivery = String(order.deliveryPartner?._id || order.deliveryPartner) === String(socket.user.userId);

          // The room carries the order's live updates, so only people allowed to
          // see the order may join it.
          if (isAdmin || isOwner || isDelivery) {
            socket.join(`order:${orderId}`);
            socket.emit("order:snapshot", { order });
          }
        } catch (_error) {
          // Ignore socket snapshot errors to keep connection alive.
        }
      }
    });

    socket.on("order:leave", ({ orderId }) => {
      if (orderId) {
        socket.leave(`order:${orderId}`);
      }
    });

    socket.on("restaurant:subscribe", ({ restaurantId }) => {
      if (restaurantId) {
        socket.join(`restaurant:${restaurantId}`);
      }
    });

    socket.on("restaurant:unsubscribe", ({ restaurantId }) => {
      if (restaurantId) {
        socket.leave(`restaurant:${restaurantId}`);
      }
    });

    // The owner room carries every order for the restaurant, customer details
    // included, so only its owner (or an admin) may join.
    socket.on("owner:restaurant:join", async ({ restaurantId } = {}) => {
      if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
        return;
      }
      try {
        const restaurant = await Restaurant.findById(restaurantId).select("ownerId").lean();
        const allowed =
          socket.user.role === "admin" ||
          (restaurant && String(restaurant.ownerId || "") === String(socket.user.userId));
        if (allowed) {
          socket.join(`owner:restaurant:${restaurantId}`);
        }
      } catch (_error) {
        // Not joined.
      }
    });

    socket.on("owner:restaurant:leave", ({ restaurantId }) => {
      if (restaurantId) {
        socket.leave(`owner:restaurant:${restaurantId}`);
      }
    });

    // Only the rider assigned to an order may publish its location. The check is
    // cached per order for this connection, so each update is not a database read.
    const assignedOrders = new Map();
    const isAssignedRider = async (orderId) => {
      if (socket.user.role !== "delivery" || !mongoose.isValidObjectId(orderId)) {
        return false;
      }
      const cached = assignedOrders.get(orderId);
      if (cached && Date.now() - cached.at < 60000) {
        return cached.allowed;
      }
      const order = await Order.findById(orderId).select("deliveryPartner status").lean();
      const allowed =
        Boolean(order) &&
        String(order.deliveryPartner || "") === String(socket.user.userId) &&
        order.status === "out_for_delivery";
      assignedOrders.set(orderId, { allowed, at: Date.now() });
      return allowed;
    };

    const relayLocation = async (payload = {}) => {
      const { orderId, location } = payload;
      const lat = Number(location?.lat);
      const lng = Number(location?.lng);
      if (!orderId || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return;
      }

      try {
        if (!(await isAssignedRider(String(orderId)))) {
          return;
        }
        io.to(`order:${orderId}`).emit("delivery:location", {
          orderId,
          location: { lat, lng },
          deliveryPartnerId: socket.user.userId,
          timestamp: new Date().toISOString(),
        });
        await User.updateOne(
          { _id: socket.user.userId },
          { "deliveryPartnerProfile.currentLocation": { lat, lng } }
        );
      } catch (_error) {
        // A failed relay is skipped; the next update follows within seconds.
      }
    };

    socket.on("delivery:location", relayLocation);
    socket.on("order:location:update", relayLocation);
  });

  setIO(io);
  return io;
};

module.exports = initializeSocket;
