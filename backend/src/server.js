const http = require("http");
const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const initializeSocket = require("./sockets");
const { initializeKafka, shutdownKafka } = require("./kafka");

const startServer = async () => {
  try {
    await connectDB();
    await initializeKafka();

    const server = http.createServer(app);
    initializeSocket(server);

    server.listen(env.port, () => {
      console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      await shutdownKafka();
      server.close(() => process.exit(0));
    };

    process.on("SIGTERM", () => {
      gracefulShutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      gracefulShutdown("SIGINT");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
