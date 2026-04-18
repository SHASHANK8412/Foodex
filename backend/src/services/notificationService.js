const twilio = require("twilio");
const admin = require("firebase-admin");
const { getIO } = require("../sockets/socketManager");
const {
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  firebaseServiceAccount,
} = require("../config/env");

// --- Firebase Admin SDK Initialization ---
try {
  if (firebaseServiceAccount) {
    const serviceAccount = JSON.parse(firebaseServiceAccount);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    console.warn("Firebase service account not provided. Push notifications will be disabled.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
}

// --- Twilio Client Initialization ---
let twilioClient;
if (twilioAccountSid && twilioAuthToken) {
  twilioClient = twilio(twilioAccountSid, twilioAuthToken);
  console.log("Twilio client initialized successfully.");
} else {
  console.warn("Twilio credentials not provided. SMS notifications will be disabled.");
}

const sendEmail = async ({ to, subject, text, html }) => {
  // This is a placeholder. In a real app, you would use a service like SendGrid,
  // Nodemailer with an SMTP server, or AWS SES.
  console.log("--- Sending Email ---");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${text || "See HTML"}`);
  console.log("---------------------");
  // Simulate email sending delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return Promise.resolve();
};

const sendSms = async (to, body) => {
  if (!twilioClient) {
    console.warn(`SMS not sent to ${to}: Twilio client not available.`);
    return Promise.resolve();
  }
  try {
    await twilioClient.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });
    console.log(`SMS sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    throw error; // Re-throw to allow Bull to handle retry
  }
};

const sendPushNotification = async (token, title, body, data = {}) => {
  if (!admin.apps.length) {
    console.warn(`Push notification not sent: Firebase Admin SDK not initialized.`);
    return Promise.resolve();
  }
  const message = {
    notification: { title, body },
    token,
    data,
  };

  try {
    await admin.messaging().send(message);
    console.log(`Push notification sent to token ${token}`);
  } catch (error) {
    console.error(`Failed to send push notification to token ${token}:`, error);
    // Handle specific errors, e.g., 'messaging/registration-token-not-registered'
    // to remove invalid tokens from the database.
    throw error;
  }
};

const pushUserNotification = async ({ userId, type, title, message, meta = {} }) => {
  // This sends a notification via Socket.io for real-time in-app updates.
  console.log(`[SOCKET NOTIFICATION:${type}] for user ${userId}: ${title}`);

  const io = getIO();
  if (!io || !userId) {
    return;
  }

  io.to(`user:${userId}`).emit("notification", {
    type,
    title,
    message,
    meta,
    createdAt: new Date().toISOString(),
  });
};

module.exports = {
  sendEmail,
  sendSms,
  sendPushNotification,
  pushUserNotification,
};
