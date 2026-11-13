import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../services/api";
import { connectSocket } from "../services/socket";
import { addToast } from "../redux/slices/uiSlice";
import { formatCurrency, formatDateTime } from "../utils/format";
import { ORDER_STATUS_LABELS } from "../utils/constants";

const ACTIVE = ["confirmed", "preparing", "out_for_delivery"];
const LOCATION_INTERVAL_MS = 10000;

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const addressText = (address = {}) => [address.line1, address.city, address.postalCode].filter(Boolean).join(", ");

const mapsLink = (address = {}) => {
  const { lat, lng } = address.location || {};
  const query = lat !== undefined && lng !== undefined ? `${lat},${lng}` : addressText(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
};

// Shares the rider's position with the customer's tracking page while an order
// is out for delivery. The server only relays it for the assigned rider.
const useLocationSharing = (token, orderIds, enabled) => {
  const [error, setError] = useState("");
  const latest = useRef(null);
  const key = orderIds.join(",");

  useEffect(() => {
    if (!enabled || !key || !navigator.geolocation) {
      return undefined;
    }

    const socket = connectSocket(token);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latest.current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setError("");
      },
      (positionError) =>
        setError(
          positionError.code === 1
            ? "Location access is blocked for this site. Allow it in the browser to share your position."
            : "Your location is not available right now."
        ),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    const send = () => {
      if (latest.current) {
        key.split(",").forEach((orderId) => socket?.emit("order:location:update", { orderId, location: latest.current }));
      }
    };
    const timer = setInterval(send, LOCATION_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [token, key, enabled]);

  return navigator.geolocation ? error : "This browser cannot share location";
};

const DeliveryDashboardPage = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const [ordersResponse, profileResponse] = await Promise.all([api.get("/orders"), api.get("/delivery/me")]);
      setOrders(ordersResponse.data.data || []);
      setIsAvailable(Boolean(profileResponse.data.data?.isAvailable));
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message }));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  // New assignments and status changes arrive over Socket.io.
  useEffect(() => {
    if (!token) return undefined;
    const socket = connectSocket(token);
    socket?.on("order:update", load);
    return () => socket?.off("order:update", load);
  }, [token, load]);

  const active = orders.filter((order) => ACTIVE.includes(order.status));
  const completed = orders.filter((order) => order.status === "delivered").slice(0, 10);
  const onRoute = active.filter((order) => order.status === "out_for_delivery").map((order) => order._id);
  const locationError = useLocationSharing(token, onRoute, sharing);

  const toggleAvailability = async () => {
    try {
      const response = await api.put("/delivery/availability", { isAvailable: !isAvailable });
      setIsAvailable(response.data.data.isAvailable);
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message }));
    }
  };

  const updateStatus = async (order, status) => {
    setBusyId(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, {
        status,
        note: status === "delivered" ? "Delivered by rider" : "Picked up by rider",
      });
      if (status === "out_for_delivery") {
        setSharing(true);
      }
      await load();
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message }));
    } finally {
      setBusyId("");
    }
  };

  const earnings = completed.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Deliveries</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            New orders are assigned to available riders with the fewest active deliveries.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isAvailable}
          onClick={toggleAvailability}
          className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold ${
            isAvailable
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-slate-400"}`} />
          {isAvailable ? "Available for orders" : "Offline"}
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{active.length}</p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivered</p>
          <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">
            {orders.filter((order) => order.status === "delivered").length}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery fees, last 10</p>
          <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(earnings)}</p>
        </div>
      </section>

      {onRoute.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200">
          <span>
            {sharing
              ? locationError || "Sharing your live location with customers every 10 seconds."
              : "Share your location so customers can follow the delivery."}
          </span>
          <button
            type="button"
            onClick={() => setSharing((value) => !value)}
            className="rounded-full bg-sky-700 px-4 py-1.5 font-semibold text-white"
          >
            {sharing ? "Stop sharing" : "Share location"}
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Active deliveries</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !active.length ? (
          <div className={`${card} text-sm text-slate-600 dark:text-slate-400`}>
            No active deliveries. {isAvailable ? "You will be notified when an order is assigned." : "Go available to receive orders."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((order) => (
              <article key={order._id} className={card}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">#{order.shortId}</p>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{order.restaurant?.name}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Drop:</span> {addressText(order.deliveryAddress)}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {(order.items || []).reduce((sum, item) => sum + item.quantity, 0)} items · {formatCurrency(order.totalAmount)} ·
                  placed {formatDateTime(order.createdAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status !== "out_for_delivery" ? (
                    <button
                      type="button"
                      disabled={busyId === order._id}
                      onClick={() => updateStatus(order, "out_for_delivery")}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                    >
                      Picked up
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === order._id}
                      onClick={() => updateStatus(order, "delivered")}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Mark delivered
                    </button>
                  )}
                  <a
                    href={mapsLink(order.deliveryAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Directions
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recently delivered</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {completed.map((order) => (
              <li key={order._id} className="flex justify-between gap-3 py-2 text-slate-700 dark:text-slate-300">
                <span>
                  #{order.shortId} · {order.restaurant?.name}
                </span>
                <span className="tabular-nums">{formatDateTime(order.updatedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default DeliveryDashboardPage;
