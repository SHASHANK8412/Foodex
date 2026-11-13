const { Kafka, logLevel, CompressionTypes } = require("kafkajs");
const env = require("../config/env");
const KAFKA_TOPICS = require("../constants/kafkaTopics");
const { buildEvent, partitionKeyFor } = require("./eventEnvelope");
const { createEventHandlers } = require("./eventHandlers");
const metrics = require("./pipelineMetrics");
const realtimeMetrics = require("../services/realtimeMetricsService");

// Event bus for the platform.
//
// With KAFKA_ENABLED=true every domain event goes to a Kafka topic (keyed, acks=all)
// and is handled by a consumer group; a second consumer reads the windowed metrics
// that Spark Structured Streaming publishes back.
// Without a broker the same events are dispatched to the same handlers in-process,
// so the application behaves identically in development and on small deployments.
//
// Delivery is at-least-once: handlers are retried, events that keep failing are
// parked on a dead-letter topic, and duplicates are dropped by eventId.

const MANAGED_TOPICS = Object.values(KAFKA_TOPICS);
const SEND_TIMEOUT_MS = 5000;
const RETRY_BACKOFF_MS = 200;
const DEDUPE_CACHE_SIZE = 5000;
const STATUS_CACHE_MS = 5000;

const state = {
  enabled: false,
  connected: false,
  admin: null,
  producer: null,
  consumer: null,
  realtimeConsumer: null,
  brokers: [],
  connectedAt: null,
  lastError: null,
};

const processedEventIds = new Map();
let topicStatusCache = { at: 0, topics: null };

const parseBrokers = () =>
  env.kafkaBrokers
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, ms, label) => {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const alreadyProcessed = (eventId) => Boolean(eventId) && processedEventIds.has(eventId);

const markProcessed = (eventId) => {
  if (!eventId) {
    return;
  }

  processedEventIds.set(eventId, true);
  if (processedEventIds.size > DEDUPE_CACHE_SIZE) {
    processedEventIds.delete(processedEventIds.keys().next().value);
  }
};

const toMessage = (event) => ({
  key: partitionKeyFor(event),
  value: JSON.stringify(event),
  headers: {
    eventType: String(event.eventType),
    schemaVersion: String(event.schemaVersion),
  },
});

const sendToKafka = async (topic, events) => {
  await withTimeout(
    state.producer.send({
      topic,
      acks: -1,
      compression: CompressionTypes.GZIP,
      messages: events.map(toMessage),
    }),
    SEND_TIMEOUT_MS,
    `Kafka send to ${topic}`
  );
};

const deadLetter = async ({ topic, reason, error, event, raw, partition, offset }) => {
  metrics.recordDeadLetter(topic);
  console.warn(`[EVENT] Dead-lettered message from ${topic}: ${reason}${error ? ` (${error})` : ""}`);

  if (!state.connected || !state.producer) {
    return;
  }

  try {
    const deadLetterEvent = buildEvent(KAFKA_TOPICS.DEAD_LETTER, {
      originalTopic: topic,
      originalEventId: event?.eventId || null,
      partition: partition ?? null,
      offset: offset ?? null,
      reason,
      error: error || null,
      payload: event ? JSON.stringify(event) : String(raw || "").slice(0, 4000),
    });
    await sendToKafka(KAFKA_TOPICS.DEAD_LETTER, [deadLetterEvent]);
    metrics.recordProduced(KAFKA_TOPICS.DEAD_LETTER, "kafka");
  } catch (sendError) {
    console.warn(`[EVENT] Could not publish to dead-letter topic: ${sendError.message}`);
  }
};

// publishEvent is declared with `function` so the handlers can call back into it.
const handlers = createEventHandlers({ publishEvent: (...args) => publishEvent(...args) });

const processEvent = async (topic, event, meta = {}) => {
  const handler = handlers[topic];
  if (!handler) {
    return;
  }

  // Simulated traffic exists to exercise the analytics path; there is no real
  // order or user behind it, so it must not trigger notifications or assignments.
  if (event.synthetic) {
    metrics.recordConsumed(topic);
    return;
  }

  if (alreadyProcessed(event.eventId)) {
    metrics.recordDuplicate(topic);
    return;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= env.kafkaConsumerMaxRetries; attempt += 1) {
    try {
      await handler(event);
      markProcessed(event.eventId);
      metrics.recordConsumed(topic);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < env.kafkaConsumerMaxRetries) {
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  metrics.recordFailure(topic);
  await deadLetter({
    topic,
    reason: "handler_failed",
    error: lastError?.message,
    event,
    partition: meta.partition,
    offset: meta.offset,
  });
};

const handleKafkaMessage = async ({ topic, partition, message }) => {
  if (!message.value) {
    return;
  }

  let event;
  try {
    event = JSON.parse(message.value.toString());
  } catch (_error) {
    await deadLetter({
      topic,
      reason: "invalid_json",
      raw: message.value.toString(),
      partition,
      offset: message.offset,
    });
    return;
  }

  await processEvent(topic, event, { partition, offset: message.offset });
};

const handleRealtimeMessage = async ({ topic, message }) => {
  if (!message.value) {
    return;
  }

  try {
    const accepted = realtimeMetrics.ingestSparkRecord(JSON.parse(message.value.toString()));
    if (accepted) {
      metrics.recordConsumed(topic);
    }
  } catch (_error) {
    metrics.recordFailure(topic);
  }
};

const disconnectAll = async () => {
  const clients = [state.consumer, state.realtimeConsumer, state.producer, state.admin].filter(Boolean);
  await Promise.allSettled(clients.map((client) => client.disconnect()));
  state.consumer = null;
  state.realtimeConsumer = null;
  state.producer = null;
  state.admin = null;
  state.connected = false;
};

const initializeKafka = async () => {
  state.enabled = env.kafkaEnabled;
  state.brokers = parseBrokers();

  if (!state.enabled) {
    console.log("Kafka disabled: events are dispatched in-process");
    return;
  }

  if (!state.brokers.length) {
    state.enabled = false;
    console.log("Kafka disabled: no brokers configured");
    return;
  }

  try {
    const kafka = new Kafka({
      clientId: env.kafkaClientId,
      brokers: state.brokers,
      logLevel: logLevel.NOTHING,
      connectionTimeout: 5000,
      retry: { retries: 5, initialRetryTime: 300 },
    });

    state.admin = kafka.admin();
    await state.admin.connect();
    await state.admin.createTopics({
      waitForLeaders: true,
      topics: MANAGED_TOPICS.map((topic) => ({
        topic,
        numPartitions: env.kafkaTopicPartitions,
        replicationFactor: env.kafkaReplicationFactor,
      })),
    });

    state.producer = kafka.producer({ allowAutoTopicCreation: false });
    await state.producer.connect();

    state.consumer = kafka.consumer({ groupId: env.kafkaGroupId });
    await state.consumer.connect();
    for (const topic of Object.keys(handlers)) {
      await state.consumer.subscribe({ topic, fromBeginning: false });
    }
    await state.consumer.run({ eachMessage: handleKafkaMessage });

    state.realtimeConsumer = kafka.consumer({ groupId: `${env.kafkaGroupId}-realtime` });
    await state.realtimeConsumer.connect();
    await state.realtimeConsumer.subscribe({ topic: KAFKA_TOPICS.ANALYTICS_REALTIME, fromBeginning: false });
    await state.realtimeConsumer.run({ eachMessage: handleRealtimeMessage });

    state.connected = true;
    state.connectedAt = new Date().toISOString();
    state.lastError = null;
    console.log(`Kafka connected (${state.brokers.join(", ")}): ${MANAGED_TOPICS.length} topics ready`);
  } catch (error) {
    state.lastError = error.message;
    await disconnectAll();
    console.warn(`Kafka unavailable (${error.message}): events are dispatched in-process`);
  }
};

// Publishes a batch of payloads to one topic. Never throws: a broker problem
// must not fail the order or payment request that raised the event.
const publishBatch = async (topic, payloads = []) => {
  const events = payloads.map((payload) => buildEvent(topic, payload));
  if (!events.length) {
    return { transport: "none", count: 0, eventIds: [] };
  }

  let transport = "in-process";

  try {
    events.forEach((event) => realtimeMetrics.ingestEvent(topic, event));

    if (state.connected && state.producer) {
      try {
        await sendToKafka(topic, events);
        transport = "kafka";
      } catch (error) {
        state.lastError = error.message;
        console.warn(`[EVENT] Kafka publish to ${topic} failed (${error.message}); handling in-process`);
      }
    }

    metrics.recordProduced(topic, transport, events.length);

    if (transport !== "kafka") {
      for (const event of events) {
        await processEvent(topic, event, { transport });
      }
    }
  } catch (error) {
    console.warn(`[EVENT] Failed to publish ${topic}: ${error.message}`);
  }

  return { transport, count: events.length, eventIds: events.map((event) => event.eventId) };
};

async function publishEvent(topic, payload) {
  return publishBatch(topic, [payload]);
}

const describeTopics = async () => {
  if (!state.connected || !state.admin) {
    return MANAGED_TOPICS.map((topic) => ({ topic, partitions: null, messages: null, consumerLag: null }));
  }

  if (topicStatusCache.topics && Date.now() - topicStatusCache.at < STATUS_CACHE_MS) {
    return topicStatusCache.topics;
  }

  const handledTopics = Object.keys(handlers);
  const committed = new Map();

  try {
    const groupOffsets = await state.admin.fetchOffsets({ groupId: env.kafkaGroupId, topics: handledTopics });
    groupOffsets.forEach((entry) => {
      committed.set(entry.topic, new Map(entry.partitions.map((item) => [item.partition, Number(item.offset)])));
    });
  } catch (_error) {
    // The group has no committed offsets until it has consumed something.
  }

  const topics = [];
  for (const topic of MANAGED_TOPICS) {
    try {
      const offsets = await state.admin.fetchTopicOffsets(topic);
      const messages = offsets.reduce((sum, item) => sum + (Number(item.high) - Number(item.low)), 0);

      let consumerLag = null;
      const groupPartitions = committed.get(topic);
      if (groupPartitions) {
        consumerLag = offsets.reduce((sum, item) => {
          const offset = groupPartitions.get(item.partition);
          // A committed offset of -1 means the group has not read that partition yet.
          return offset === undefined || offset < 0 ? sum : sum + Math.max(0, Number(item.high) - offset);
        }, 0);
      }

      topics.push({ topic, partitions: offsets.length, messages, consumerLag });
    } catch (_error) {
      topics.push({ topic, partitions: null, messages: null, consumerLag: null });
    }
  }

  topicStatusCache = { at: Date.now(), topics };
  return topics;
};

const getKafkaStatus = async () => ({
  enabled: state.enabled,
  connected: state.connected,
  transport: state.connected ? "kafka" : "in-process",
  brokers: state.brokers,
  clientId: env.kafkaClientId,
  consumerGroup: env.kafkaGroupId,
  connectedAt: state.connectedAt,
  lastError: state.lastError,
  delivery: "at-least-once, keyed by order/session, idempotent consumers, dead-letter topic",
  topics: await describeTopics(),
});

const shutdownKafka = async () => {
  await disconnectAll();
};

module.exports = {
  initializeKafka,
  publishEvent,
  publishBatch,
  getKafkaStatus,
  shutdownKafka,
  processEvent,
};
