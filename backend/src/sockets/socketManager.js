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

  if (order.restaurant?._id || order.restaurant) {
    ioInstance.to(`owner:restaurant:${order.restaurant?._id || order.restaurant}`).emit("owner:order:update", {
      message,
      order,
    });
  }
};

const emitDeliveryLocation = ({ orderId, location, deliveryPartnerId }) => {
  if (!ioInstance || !orderId || !location) {
    return;
  }

  ioInstance.to(`order:${orderId}`).emit("delivery:location", {
    orderId,
    location,
    deliveryPartnerId,
    timestamp: new Date().toISOString(),
  });
};

const emitDemandUpdate = ({ restaurantId, activeOrders, demandLevel, estimatedWaitMinutes }) => {
  if (!ioInstance || !restaurantId) {
    return;
  }

  const payload = {
    restaurantId,
    activeOrders,
    demandLevel,
    estimatedWaitMinutes,
    timestamp: new Date().toISOString(),
  };

  ioInstance.to(`restaurant:${restaurantId}`).emit("demand:update", payload);
  ioInstance.emit("demand:update", payload);
};

module.exports = {
  setIO,
  getIO,
  emitOrderUpdate,
  emitDeliveryLocation,
  emitDemandUpdate,
};
