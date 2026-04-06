const { getIO } = require("../sockets/socketManager");

const pushUserNotification = async ({ userId, type, title, message, meta = {} }) => {
  // Replace this with persistent notification storage if needed.
  console.log(`[NOTIFICATION:${type}] ${title} - ${message}`);

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
  pushUserNotification,
};
