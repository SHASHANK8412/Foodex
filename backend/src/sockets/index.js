const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { setIO } = require("./socketManager");

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

    socket.on("delivery:location", ({ orderId, location }) => {
      if (orderId && location) {
        io.to(`order:${orderId}`).emit("delivery:location", {
          orderId,
          location,
          deliveryPartnerId: socket.user.userId,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  setIO(io);
  return io;
};

module.exports = initializeSocket;
