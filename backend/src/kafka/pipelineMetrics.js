// In-memory counters for the event pipeline, exposed on the admin Data Pipeline page.
// They describe this API process only; broker-side totals come from the Kafka admin client.

const BUCKET_MS = 10 * 1000;
const MAX_BUCKETS = 30; // five minutes of throughput history

const startedAt = new Date().toISOString();
const topics = new Map();
const transports = { kafka: 0, inProcess: 0 };
const throughput = new Map();

const topicStats = (topic) => {
  if (!topics.has(topic)) {
    topics.set(topic, {
      produced: 0,
      consumed: 0,
      failed: 0,
      deadLettered: 0,
      duplicatesSkipped: 0,
      lastProducedAt: null,
      lastConsumedAt: null,
    });
  }

  return topics.get(topic);
};

const recordThroughput = (count) => {
  const bucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  throughput.set(bucket, (throughput.get(bucket) || 0) + count);

  if (throughput.size > MAX_BUCKETS) {
    const oldest = [...throughput.keys()].sort((a, b) => a - b).slice(0, throughput.size - MAX_BUCKETS);
    oldest.forEach((key) => throughput.delete(key));
  }
};

const recordProduced = (topic, transport, count = 1) => {
  const stats = topicStats(topic);
  stats.produced += count;
  stats.lastProducedAt = new Date().toISOString();
  transports[transport === "kafka" ? "kafka" : "inProcess"] += count;
  recordThroughput(count);
};

const recordConsumed = (topic) => {
  const stats = topicStats(topic);
  stats.consumed += 1;
  stats.lastConsumedAt = new Date().toISOString();
};

const recordFailure = (topic) => {
  topicStats(topic).failed += 1;
};

const recordDeadLetter = (topic) => {
  topicStats(topic).deadLettered += 1;
};

const recordDuplicate = (topic) => {
  topicStats(topic).duplicatesSkipped += 1;
};

const getSnapshot = () => {
  const now = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  const series = [];
  for (let index = MAX_BUCKETS - 1; index >= 0; index -= 1) {
    const bucket = now - index * BUCKET_MS;
    series.push({ at: new Date(bucket).toISOString(), events: throughput.get(bucket) || 0 });
  }

  const perTopic = {};
  let totalProduced = 0;
  let totalConsumed = 0;
  let totalDeadLettered = 0;
  topics.forEach((stats, topic) => {
    perTopic[topic] = { ...stats };
    totalProduced += stats.produced;
    totalConsumed += stats.consumed;
    totalDeadLettered += stats.deadLettered;
  });

  return {
    startedAt,
    totals: {
      produced: totalProduced,
      consumed: totalConsumed,
      deadLettered: totalDeadLettered,
    },
    transports: { ...transports },
    throughput: { bucketSeconds: BUCKET_MS / 1000, series },
    topics: perTopic,
  };
};

const reset = () => {
  topics.clear();
  throughput.clear();
  transports.kafka = 0;
  transports.inProcess = 0;
};

module.exports = {
  recordProduced,
  recordConsumed,
  recordFailure,
  recordDeadLetter,
  recordDuplicate,
  getSnapshot,
  reset,
};
