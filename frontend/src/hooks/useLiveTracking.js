import React, { useState, useEffect, useRef } from "react";
import { getSocket } from "../services/socket";

const useLiveTracking = (orderId) => {
  const [location, setLocation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socket = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    socket.current = getSocket();
    if (!socket.current) {
      return;
    }

    const handleConnect = () => {
      setIsConnected(true);
      socket.current.emit("order:join", { orderId });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleLocationUpdate = (data) => {
      if (data.orderId === orderId) {
        setLocation(data.location);
      }
    };

    socket.current.on("connect", handleConnect);
    socket.current.on("disconnect", handleDisconnect);
    socket.current.on("delivery:location", handleLocationUpdate);

    if (socket.current.connected) {
      handleConnect();
    }

    return () => {
      if (socket.current) {
        socket.current.emit("order:leave", { orderId });
        socket.current.off("connect", handleConnect);
        socket.current.off("disconnect", handleDisconnect);
        socket.current.off("delivery:location", handleLocationUpdate);
      }
    };
  }, [orderId]);

  return { location, isConnected };
};

export default useLiveTracking;
