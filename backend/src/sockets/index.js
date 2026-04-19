const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { setIO } = require("./socketManager");
const Order = require("../models/Order");
const ROLES = require("../constants/roles");

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
      origin: env.clientUrl,
      credentials: true,
    },
  });

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

    socket.on("order:join", ({ orderId }) => {
      if (orderId) {
        socket.join(`order:${orderId}`);
      }
    });

    socket.on("order:leave", ({ orderId }) => {
      if (orderId) {
        socket.leave(`order:${orderId}`);
      }
    });

    socket.on("delivery:location", async ({ orderId, location }) => {
      try {
        if (!orderId || !isValidLatLng(location)) return;
        if (socket.user?.role !== ROLES.DELIVERY) return;

        const order = await Order.findById(orderId).select("deliveryPartner");
        if (!order?.deliveryPartner) return;
        if (String(order.deliveryPartner) !== String(socket.user.userId)) return;

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
      } catch (error) {
        // ignore invalid/unauthorized updates
      }
    });
  });

  setIO(io);
  return io;
};

module.exports = initializeSocket;
