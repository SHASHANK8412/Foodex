const http = require("http");
const crypto = require("crypto");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express5");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/use/ws");
const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");
const initializeSocket = require("./sockets");
const { initializeKafka, shutdownKafka } = require("./kafka");
const redisClient = require("./config/redis");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const typeDefs = require("./graphql/typeDefs");
const resolvers = require("./graphql/resolvers");
const { buildGraphqlContext } = require("./graphql/context");
const { ensureDemoData } = require("./seeders/demoData");

// Start job processors
require("./jobs/emailProcessor");
require("./jobs/smsProcessor");
require("./jobs/pushNotificationProcessor");
require("./jobs/analyticsProcessor");
const { schedulePeriodicJobs } = require("./jobs/periodic");
const { startMenuAvailabilityCron } = require("./jobs/menuAvailabilityJob");

const persistedQueryCache = new Map();

const listenWithPortFallback = (server, startingPort, nodeEnv, maxRetries = 10) => {
  const attempt = (port, retriesLeft) =>
    new Promise((resolve, reject) => {
      let settled = false;

      const onListening = () => {
        if (settled) {
          return;
        }
        settled = true;
        server.off("error", onError);
        const activePort = server.address()?.port || port;
        console.log(`Server running on port ${activePort} in ${nodeEnv} mode`);
        resolve(activePort);
      };

      const onError = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        server.off("listening", onListening);

        if (error?.code === "EADDRINUSE" && retriesLeft > 0) {
          console.warn(`Port ${port} is busy. Retrying on ${port + 1}...`);
          resolve(attempt(port + 1, retriesLeft - 1));
          return;
        }

        reject(error);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port);
    });

  return attempt(startingPort, maxRetries);
};

const startServer = async () => {
  try {
    await connectDB();

    if (env.nodeEnv === "development") {
      await ensureDemoData();
    }

    await initializeKafka();

    const server = http.createServer(app);
    initializeSocket(server);

    const graphqlSchema = makeExecutableSchema({ typeDefs, resolvers });
    const apolloServer = new ApolloServer({ schema: graphqlSchema });
    await apolloServer.start();

    app.use(env.graphqlPath, (req, _res, next) => {
      const hash = req.body?.extensions?.persistedQuery?.sha256Hash;
      if (!hash) {
        return next();
      }

      if (req.body?.query) {
        const queryHash = crypto.createHash("sha256").update(req.body.query).digest("hex");
        if (queryHash === hash) {
          persistedQueryCache.set(hash, req.body.query);
        }
        return next();
      }

      const cached = persistedQueryCache.get(hash);
      if (cached) {
        req.body.query = cached;
      }

      return next();
    });

    app.use(
      env.graphqlPath,
      expressMiddleware(apolloServer, {
        context: buildGraphqlContext,
      })
    );

    app.use(notFound);
    app.use(errorHandler);

    let wsServerCleanup = null;

    // Schedule periodic jobs
    schedulePeriodicJobs();
    startMenuAvailabilityCron();

    await listenWithPortFallback(server, env.port, env.nodeEnv);

    const wsServer = new WebSocketServer({
      server,
      path: env.graphqlPath,
    });

    wsServer.on("error", (error) => {
      console.error("GraphQL WebSocket server error:", error.message);
    });

    wsServerCleanup = useServer(
      {
        schema: graphqlSchema,
        context: async (ctx) => {
          const token = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization || "";
          const fakeReq = {
            headers: {
              authorization: String(token).startsWith("Bearer ") ? token : `Bearer ${token}`,
            },
          };
          return buildGraphqlContext({ req: fakeReq });
        },
      },
      wsServer
    );

    const gracefulShutdown = async (signal) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      await shutdownKafka();
      await apolloServer.stop();
      await wsServerCleanup?.dispose();
      redisClient.quit();
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
