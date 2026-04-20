const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const redisClient = require("../config/redis");
const { setIO } = require("./socketManager");
const Order = require("../models/Order");

const ROLES = require("../constants/roles");

const socketAllowedOrigins = env.clientOrigins;

const isValidLatLng = (location) => {
  if (!location) return false;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return true;
};

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

    socket.on("order:join", async ({ orderId }) => {
      if (orderId) {
        socket.join(`order:${orderId}`);

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

          if (isAdmin || isOwner || isDelivery) {
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

    socket.on("owner:restaurant:join", ({ restaurantId }) => {
      if (restaurantId) {
        socket.join(`owner:restaurant:${restaurantId}`);
      }
    });

    socket.on("owner:restaurant:leave", ({ restaurantId }) => {
      if (restaurantId) {
        socket.leave(`owner:restaurant:${restaurantId}`);
      }
    });

    const handleDeliveryLocationUpdate = async ({ orderId, location }) => {
      try {
        if (!orderId || !isValidLatLng(location)) {
          return;
        }

        if (socket.user?.role !== ROLES.DELIVERY) {
          return;
        }

        const order = await Order.findById(orderId).select("deliveryPartner");
        if (!order?.deliveryPartner) {
          return;
        }

        if (String(order.deliveryPartner) !== String(socket.user.userId)) {
          return;
        }

        await Order.findByIdAndUpdate(
          orderId,
          {
            currentDeliveryLocation: { lat: Number(location.lat), lng: Number(location.lng) },
            currentDeliveryLocationUpdatedAt: new Date(),
          },
          { new: false }
        );

        io.to(`order:${orderId}`).emit("delivery:location", {
          orderId,
          location: { lat: Number(location.lat), lng: Number(location.lng) },
          deliveryPartnerId: socket.user.userId,
          timestamp: new Date().toISOString(),
        });
      } catch (_error) {
        // ignore invalid/unauthorized updates
      }
    };

    socket.on("delivery:location", handleDeliveryLocationUpdate);
    socket.on("order:location:update", handleDeliveryLocationUpdate);
  });
  return io;
};

module.exports = initializeSocket;
