const crypto = require("crypto");

const SCHEMA_VERSION = 1;
const EVENT_SOURCE = "foodex-backend";

// Wraps a domain payload in the envelope every consumer (Node and Spark) relies on.
// Payload fields stay at the top level so Spark can parse the value with one flat schema.
const buildEvent = (topic, payload = {}) => {
  const now = new Date().toISOString();

  return {
    ...payload,
    eventId: payload.eventId || crypto.randomUUID(),
    eventType: topic,
    schemaVersion: SCHEMA_VERSION,
    occurredAt: payload.occurredAt || now,
    emittedAt: now,
    source: EVENT_SOURCE,
  };
};

// Events for the same order (or browsing session) share a key, so Kafka keeps
// them on one partition and consumers see them in the order they happened.
const partitionKeyFor = (event) =>
  String(event.orderId || event.sessionId || event.userId || event.eventId);

module.exports = {
  SCHEMA_VERSION,
  EVENT_SOURCE,
  buildEvent,
  partitionKeyFor,
};
