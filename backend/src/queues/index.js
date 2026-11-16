const Bull = require("bull");
const { redisUrl, redisEnabled } = require("../config/env");

const queueOptions = {
  redis: redisUrl,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  },
};

const createNoopQueue = () => ({
  add: async () => null,
  process: () => undefined,
  on: () => undefined,
  close: async () => undefined,
});

const emailQueue = redisEnabled ? new Bull("email", queueOptions) : createNoopQueue();
const smsQueue = redisEnabled ? new Bull("sms", queueOptions) : createNoopQueue();
const pushNotificationQueue = redisEnabled ? new Bull("push-notification", queueOptions) : createNoopQueue();
const analyticsQueue = redisEnabled ? new Bull("analytics", queueOptions) : createNoopQueue();

module.exports = {
  redisQueueEnabled: redisEnabled,
  emailQueue,
  smsQueue,
  pushNotificationQueue,
  analyticsQueue,
};
