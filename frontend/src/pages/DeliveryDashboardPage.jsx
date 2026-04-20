import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchOrders, setActiveOrderFromSocket } from "../redux/slices/orderSlice";
import { connectSocket, disconnectSocket } from "../services/socket";

const DeliveryDashboardPage = () => {
  const dispatch = useDispatch();
  const { orders, loading, error } = useSelector((state) => state.orders);
  const { token } = useSelector((state) => state.auth);
  const [notifications, setNotifications] = useState([]);

  const { activeOrders, deliveredOrders } = useMemo(() => {
    const active = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled");
    const delivered = orders.filter((order) => order.status === "delivered");
    return { activeOrders: active, deliveredOrders: delivered };
  }, [orders]);

  useEffect(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return;
    }

    const onOrderUpdate = (payload) => {
      if (!payload?.order?._id) {
        return;
      }

      dispatch(setActiveOrderFromSocket(payload.order));

      const message = payload?.message || "Order updated";
      setNotifications((prev) => {
        const next = [
          {
            id: Date.now() + Math.floor(Math.random() * 1000),
            message,
            createdAt: new Date().toISOString(),
            orderId: payload.order._id,
          },
          ...prev,
        ];
        return next.slice(0, 10);
      });
    };

    const onNotification = (payload) => {
      const message = payload?.message || payload?.title || "Notification";
      setNotifications((prev) => {
        const next = [
          {
            id: Date.now() + Math.floor(Math.random() * 1000),
            message,
            createdAt: payload?.createdAt || new Date().toISOString(),
            orderId: payload?.meta?.orderId,
          },
          ...prev,
        ];
        return next.slice(0, 10);
      });
    };

    socket.on("order:update", onOrderUpdate);
    socket.on("notification", onNotification);

    return () => {
      socket.off("order:update", onOrderUpdate);
      socket.off("notification", onNotification);
      disconnectSocket();
    };
  }, [token, dispatch]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Delivery dashboard</h1>
        <p className="text-sm text-slate-600">View your assigned orders and open tracking.</p>
      </header>

      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No new notifications.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {notifications.map((note) => (
              <li key={note.id} className="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{note.message}</p>
                {note.orderId && <p className="mt-1 text-xs text-slate-500">Order {String(note.orderId).slice(-8)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Active deliveries</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : activeOrders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No active deliveries right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {activeOrders.map((order) => (
              <article key={order._id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Order {order._id.slice(-8)}</p>
                  <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{order.status}</p>
                </div>

                <p className="mt-2 text-sm text-slate-600">Restaurant: {order.restaurant?.name || "—"}</p>
                <p className="mt-1 text-sm text-slate-600">Total: ₹{Number(order.totalAmount || 0).toFixed(2)}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/orders/track?orderId=${order._id}`}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
                  >
                    Open tracking
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Delivered</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : deliveredOrders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No delivered orders yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {deliveredOrders.map((order) => (
              <article key={order._id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Order {order._id.slice(-8)}</p>
                  <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-700">
                    delivered
                  </p>
                </div>

                <p className="mt-2 text-sm text-slate-600">Restaurant: {order.restaurant?.name || "—"}</p>
                <p className="mt-1 text-sm text-slate-600">Total: ₹{Number(order.totalAmount || 0).toFixed(2)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DeliveryDashboardPage;
