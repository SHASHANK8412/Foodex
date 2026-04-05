let ioInstance = null;

const setIO = (io) => {
  ioInstance = io;
};

const getIO = () => ioInstance;

const emitOrderUpdate = (order, message = "Order updated") => {
  if (!ioInstance || !order) {
    return;
  }

  ioInstance.to(`order:${order._id}`).emit("order:update", {
    message,
    order,
  });

  if (order.user) {
    ioInstance.to(`user:${order.user}`).emit("order:update", {
      message,
      order,
    });
  }

  if (order.deliveryPartner) {
    ioInstance.to(`user:${order.deliveryPartner}`).emit("order:update", {
      message,
      order,
    });
  }
};

module.exports = {
  setIO,
  getIO,
  emitOrderUpdate,
};
