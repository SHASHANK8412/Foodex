const { emailQueue } = require("../queues");
const notificationService = require("../services/notificationService");

emailQueue.process(async (job) => {
  const { to, subject, text, html } = job.data;
  await notificationService.sendEmail({ to, subject, text, html });
});

emailQueue.on("failed", (job, err) => {
  console.error(`Email job ${job.id} failed with error: ${err.message}`);
});

console.log("📧 Email processor started");
