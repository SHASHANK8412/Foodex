import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { fetchOrderById, fetchOrders, setActiveOrderFromSocket } from "../redux/slices/orderSlice";
import MapView from "../components/MapView";
import OrderStatusTimeline from "../components/OrderStatusTimeline";
import { connectSocket } from "../services/socket";
import { formatCurrency, formatDateTime } from "../utils/format";

const OrderTrackingPage = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { token } = useSelector((state) => state.auth);
  const { orders, activeOrder, loading } = useSelector((state) => state.orders);
  const [liveLocation, setLiveLocation] = useState(null);
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

  const currentOrder = activeOrder || orders[0];
  const activeRoomOrderId = orderId || currentOrder?._id;

  useEffect(() => {
    if (!token || !activeRoomOrderId) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    socket.emit("order:join", { orderId: activeRoomOrderId });

    const onOrderUpdate = (payload) => {
      if (payload?.order) {
        dispatch(setActiveOrderFromSocket(payload.order));
      }
    };

    const onOrderSnapshot = (payload) => {
      if (payload?.order) {
        dispatch(setActiveOrderFromSocket(payload.order));
      }
    };

    const onDeliveryLocation = (payload) => {
      if (payload?.orderId === activeRoomOrderId && payload?.location) {
        setLiveLocation(payload.location);
      }
    };

    socket.on("order:update", onOrderUpdate);
    socket.on("order:snapshot", onOrderSnapshot);
    socket.on("delivery:location", onDeliveryLocation);

    return () => {
      socket.emit("order:leave", { orderId: activeRoomOrderId });
      socket.off("order:update", onOrderUpdate);
      socket.off("order:snapshot", onOrderSnapshot);
      socket.off("delivery:location", onDeliveryLocation);
    };
  }, [token, activeRoomOrderId, dispatch]);

  useEffect(() => {
    if (!currentOrder?.trackingEvents?.length) {
      return;
    }

    const latestLocationEvent = [...currentOrder.trackingEvents]
      .reverse()
      .find((event) => event.location?.lat !== undefined && event.location?.lng !== undefined);

    if (latestLocationEvent?.location) {
      setLiveLocation(latestLocationEvent.location);
    }
  }, [currentOrder]);
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

          <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-2/3 flex flex-col gap-6">
                {currentOrder && (
                  <>
                    <div className="rounded-lg bg-white p-6 shadow-md">
                      <h2 className="mb-4 text-2xl font-bold text-slate-900">Live Tracking</h2>
                      {(currentOrder.restaurant?.address?.location || currentOrder.restaurant?.location) &&
                      currentOrder.deliveryAddress?.location ? (
                        <MapView order={currentOrder} />
                      ) : (
                        <p className="text-sm font-medium text-slate-700">Location data not available for map view.</p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white p-6 shadow-md">
                      <h2 className="mb-4 text-2xl font-bold text-slate-900">Order Status</h2>
                      <OrderStatusTimeline events={currentOrder.trackingEvents} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Live map</span>
              <span>{etaProgress}% complete</span>
            </div>
            <div className="mt-3 h-40 overflow-hidden rounded-xl bg-[linear-gradient(130deg,#e2e8f0,#f8fafc)] p-3 dark:bg-[linear-gradient(130deg,#1e293b,#0f172a)]">
              <div className="relative h-full w-full rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                <div className="absolute left-3 top-6 h-2 w-2 rounded-full bg-emerald-500" />
                <div className="absolute right-8 bottom-6 h-2 w-2 rounded-full bg-rose-500" />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-slate-900 transition-all duration-700 dark:bg-slate-100"
                  style={{ left: `${Math.max(8, etaProgress - 4)}%` }}
                />
                {liveLocation && (
                  <p className="absolute bottom-2 left-2 rounded-md bg-white/85 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-900/85 dark:text-slate-200">
                    Live: {Number(liveLocation.lat).toFixed(4)}, {Number(liveLocation.lng).toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          </div>

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
