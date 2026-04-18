import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { ROLES } from "../utils/constants";

// Mock data for now
const mockOrders = [
  {
    _id: "order1",
    restaurant: { name: "Pizza Palace", location: { lat: 28.62, lng: 77.22 } },
    deliveryAddress: { line1: "123, Connaught Place", location: { lat: 28.63, lng: 77.21 } },
    status: "PREPARING",
    totalAmount: 550,
  },
  {
    _id: "order2",
    restaurant: { name: "Burger Barn", location: { lat: 28.55, lng: 77.25 } },
    deliveryAddress: { line1: "456, Hauz Khas", location: { lat: 28.54, lng: 77.21 } },
    status: "OUT_FOR_DELIVERY",
    totalAmount: 800,
  },
];

const DeliveryDashboardPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [isAvailable, setIsAvailable] = useState(true);
  const [orders, setOrders] = useState(mockOrders);

  if (user?.role !== ROLES.DELIVERY_PARTNER) {
    return <Navigate to="/" />;
  }

  const handleStatusUpdate = (orderId, newStatus) => {
    // In a real app, this would dispatch an action to call the API
    console.log(`Updating order ${orderId} to ${newStatus}`);
    setOrders(
      orders.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Delivery Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="font-semibold">Availability:</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={() => setIsAvailable(!isAvailable)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* In a real app, a map view of orders would go here */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((order) => (
          <div key={order._id} className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-bold text-lg">{order.restaurant.name}</h3>
            <p className="text-sm text-gray-600">{order.deliveryAddress.line1}</p>
            <p className="font-bold my-2">Status: <span className="text-blue-600">{order.status}</span></p>
            <div className="flex gap-2 mt-4">
              {order.status === "PREPARING" && (
                <button
                  onClick={() => handleStatusUpdate(order._id, "OUT_FOR_DELIVERY")}
                  className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm"
                >
                  Pick Up
                </button>
              )}
              {order.status === "OUT_FOR_DELIVERY" && (
                <button
                  onClick={() => handleStatusUpdate(order._id, "DELIVERED")}
                  className="bg-green-500 text-white px-3 py-1 rounded-md text-sm"
                >
                  Mark Delivered
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeliveryDashboardPage;
