const Redis = require("ioredis");
const { redisEnabled, redisUrl } = require("./env");

let redisClient;

if (process.env.NODE_ENV === "test" || !redisEnabled) {
  const noop = async () => null;
  redisClient = {
    call: noop,
    duplicate: () => redisClient,
    on: () => redisClient,
    quit: async () => undefined,
  };
} else {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  redisClient.on("connect", () => {
    console.log("Redis client connected");
  });

  redisClient.on("error", (err) => {
    console.error("Redis client connection error", err);
  });
}

module.exports = redisClient;
