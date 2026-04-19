import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { fetchOrderById, fetchOrders, setActiveOrderFromSocket } from "../redux/slices/orderSlice";
import OrderStatusTimeline from "../components/OrderStatusTimeline";
import { connectSocket, disconnectSocket } from "../services/socket";
import { formatCurrency, formatDateTime } from "../utils/format";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const isValidLatLng = (value) =>
  Boolean(
    value &&
      Number.isFinite(Number(value.lat)) &&
      Number.isFinite(Number(value.lng)) &&
      Math.abs(Number(value.lat)) <= 90 &&
      Math.abs(Number(value.lng)) <= 180
  );

const createDotIcon = (className) =>
  L.divIcon({
    className: "",
    html: `<div class="${className}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const driverIcon = createDotIcon(
  "h-3.5 w-3.5 rounded-full bg-slate-900 ring-4 ring-white/85 shadow-sm dark:bg-slate-50 dark:ring-slate-950/70"
);
const destinationIcon = createDotIcon(
  "h-3.5 w-3.5 rounded-full bg-rose-500 ring-4 ring-white/85 shadow-sm dark:ring-slate-950/70"
);

const FitBounds = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !points?.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.35), { animate: true });
  }, [map, points]);
  return null;
};

const OrderTrackingPage = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { token } = useSelector((state) => state.auth);
  const { orders, activeOrder, loading } = useSelector((state) => state.orders);
  const [driverLocation, setDriverLocation] = useState(null);
  const socketRef = useRef(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { from: "delivery", text: "Hi, I picked up your order and I am on my way." },
    { from: "customer", text: "Great, please call once you reach the gate." },
  ]);

  useEffect(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  useEffect(() => {
    if (orderId) {
      dispatch(fetchOrderById(orderId));
    }
  }, [dispatch, orderId]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    socketRef.current = socket;

    const onOrderUpdate = (payload) => {
      if (payload?.order) {
        dispatch(setActiveOrderFromSocket(payload.order));
      }
    };

    const onDeliveryLocation = (payload) => {
      if (!payload?.orderId) return;
      if (!isValidLatLng(payload.location)) return;
      setDriverLocation({
        lat: Number(payload.location.lat),
        lng: Number(payload.location.lng),
        timestamp: payload.timestamp,
      });
    };

    socket.on("order:update", onOrderUpdate);
    socket.on("delivery:location", onDeliveryLocation);

    return () => {
      socket.off("order:update", onOrderUpdate);
      socket.off("delivery:location", onDeliveryLocation);
      disconnectSocket();
      socketRef.current = null;
    };
  }, [token, dispatch]);

  const currentOrder = activeOrder || orders[0];

  const roomOrderId = useMemo(() => {
    return orderId || currentOrder?._id || null;
  }, [orderId, currentOrder?._id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !roomOrderId) return undefined;

    socket.emit("order:join", { orderId: roomOrderId });
    return () => {
      socket.emit("order:leave", { orderId: roomOrderId });
    };
  }, [roomOrderId]);

  useEffect(() => {
    const persisted = currentOrder?.currentDeliveryLocation;
    if (!isValidLatLng(persisted)) return;
    setDriverLocation((prev) => {
      if (prev?.timestamp) return prev;
      return {
        lat: Number(persisted.lat),
        lng: Number(persisted.lng),
        timestamp: currentOrder?.currentDeliveryLocationUpdatedAt,
      };
    });
  }, [currentOrder?.currentDeliveryLocation, currentOrder?.currentDeliveryLocationUpdatedAt]);
  const destination = useMemo(() => {
    const loc = currentOrder?.deliveryAddress?.location;
    if (!isValidLatLng(loc)) return null;
    return { lat: Number(loc.lat), lng: Number(loc.lng) };
  }, [currentOrder?.deliveryAddress?.location]);

  const mapPoints = useMemo(() => {
    const points = [];
    if (driverLocation) points.push({ lat: driverLocation.lat, lng: driverLocation.lng });
    if (destination) points.push(destination);
    return points;
  }, [driverLocation, destination]);

  const mapCenter = useMemo(() => {
    if (driverLocation) return [driverLocation.lat, driverLocation.lng];
    if (destination) return [destination.lat, destination.lng];
    return [20.5937, 78.9629];
  }, [driverLocation, destination]);
  const etaProgress = useMemo(() => {
    const statusMap = {
      pending: 15,
      confirmed: 30,
      preparing: 55,
      out_for_delivery: 85,
      delivered: 100,
    };
    return statusMap[currentOrder?.status] || 0;
  }, [currentOrder?.status]);

  const sendChat = (event) => {
    event.preventDefault();
    if (!chatInput.trim()) {
      return;
    }

    setChatMessages((prev) => [...prev, { from: "customer", text: chatInput.trim() }]);
    setChatInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Order tracking</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Watch status changes in real time.</p>
      </div>

      {loading && <p className="rounded-2xl bg-white p-6 dark:bg-slate-900">Loading orders...</p>}

      {currentOrder ? (
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Order ID</p>
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{currentOrder._id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(currentOrder.totalAmount)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Live map</span>
              <span>{etaProgress}% complete</span>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-950/30">
              <div className="h-44">
                <MapContainer
                  center={mapCenter}
                  zoom={13}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                  attributionControl={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {mapPoints.length > 0 && <FitBounds points={mapPoints} />}

                  {driverLocation && (
                    <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
                  )}
                  {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />}
                  {driverLocation && destination && (
                    <Polyline
                      positions={[
                        [driverLocation.lat, driverLocation.lng],
                        [destination.lat, destination.lng],
                      ]}
                      pathOptions={{ weight: 3, opacity: 0.75 }}
                    />
                  )}
                </MapContainer>
              </div>

              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {driverLocation
                    ? "Delivery partner is moving live"
                    : "Waiting for delivery partner location"}
                </span>
                {driverLocation?.timestamp && (
                  <span className="text-slate-500 dark:text-slate-400">Updated {formatDateTime(driverLocation.timestamp)}</span>
                )}
              </div>
            </div>
          </div>

          <OrderStatusTimeline status={currentOrder.status} />

          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Tracking events</h2>
            <ul className="mt-3 space-y-2">
              {(currentOrder.trackingEvents || []).map((event, index) => (
                <li key={index} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.status}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{event.note || "Status update"}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(event.timestamp)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">Delivery chat</h2>
            <div className="mt-3 h-44 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm " +
                    (msg.from === "customer"
                      ? "ml-auto bg-slate-900 text-white"
                      : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200")
                  }
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <form onSubmit={sendChat} className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type message to delivery partner"
                className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button type="submit" className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white">
                Send
              </button>
            </form>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">No orders found yet.</p>
      )}
    </div>
  );
};

export default OrderTrackingPage;
