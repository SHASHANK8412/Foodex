// Load generator: pushes synthetic sessions and orders through the event bus.
//
//   npm run kafka:load -- --orders 20000 --batch 250
//
// With KAFKA_ENABLED=true the events land on the Kafka topics, where the Spark
// Structured Streaming job aggregates them and the lake ingest job stores them.
// Events are flagged `synthetic`, so nothing is written to MongoDB.

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { initializeKafka, shutdownKafka, getKafkaStatus } = require("../kafka");
const { simulateTraffic } = require("../services/pipelineService");

const readNumberFlag = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

const run = async () => {
  const totalOrders = readNumberFlag("orders", 5000);
  const batchSize = Math.min(500, readNumberFlag("batch", 250));

  await connectDB();
  await initializeKafka();

  const status = await getKafkaStatus();
  console.log(`Transport: ${status.transport}${status.connected ? ` (${status.brokers.join(", ")})` : ""}`);
  if (!status.connected) {
    console.log("Kafka is not connected, so events are only aggregated in this process.");
  }

  const startedAt = Date.now();
  let orders = 0;
  let events = 0;

  while (orders < totalOrders) {
    const result = await simulateTraffic({ orders: Math.min(batchSize, totalOrders - orders) });
    orders += result.orders;
    events += result.totalEvents;
    process.stdout.write(`\r${orders}/${totalOrders} orders, ${events} events`);
  }

  const seconds = (Date.now() - startedAt) / 1000;
  console.log(
    `\nPublished ${events} events for ${orders} orders in ${seconds.toFixed(1)}s ` +
      `(${Math.round(events / Math.max(seconds, 0.001))} events/s)`
  );

  await shutdownKafka();
  await mongoose.disconnect();
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Load generation failed:", error.message);
    process.exit(1);
  });
