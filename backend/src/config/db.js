const mongoose = require("mongoose");
const env = require("./env");

const connectDB = async () => {
  // Assumption: traditional long-running Express server with moderate OLTP traffic.
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 300000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
  });

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
  });

  console.log("MongoDB connected successfully");
};

module.exports = connectDB;
