const { pushNotificationQueue } = require("../queues");
const notificationService = require("../services/notificationService");

pushNotificationQueue.process(async (job) => {
  const { token, title, body, data } = job.data;
  await notificationService.sendPushNotification(token, title, body, data);
});

pushNotificationQueue.on("failed", (job, err) => {
  console.error(`Push notification job ${job.id} failed with error: ${err.message}`);
});

console.log("📲 Push notification processor started");
