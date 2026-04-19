import { io } from "socket.io-client";

let socket = null;

export const connectSocket = (token) => {
  if (!token) {
    return null;
  }

  if (socket) {
    return socket;
  }

  const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

  socket = io(socketBaseUrl, {
    autoConnect: true,
    auth: {
      token,
    },
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
