const { smsQueue } = require("../queues");
const notificationService = require("../services/notificationService");

smsQueue.process(async (job) => {
  const { to, body } = job.data;
  await notificationService.sendSms(to, body);
});

smsQueue.on("failed", (job, err) => {
  console.error(`SMS job ${job.id} failed with error: ${err.message}`);
});

console.log("📱 SMS processor started");
