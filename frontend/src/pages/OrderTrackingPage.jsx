import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { Bike, CircleAlert, Phone } from "lucide-react";
import { fetchOrderById, fetchOrders, setActiveOrderFromSocket } from "../redux/slices/orderSlice";
import MapView from "../components/MapView";
import OrderStatusTimeline from "../components/OrderStatusTimeline";
import PaymentMethodPicker from "../components/PaymentMethodPicker";
import api from "../services/api";
import { connectSocket } from "../services/socket";
import { payForOrder } from "../services/checkoutFlow";
import { loadCheckoutDetails } from "../utils/checkoutDetails";
import { PAYMENT_METHOD_LABELS } from "../utils/paymentMethods";
import { ORDER_STATUS_LABELS } from "../utils/constants";
import { formatCurrency, formatDateTime } from "../utils/format";

const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const paidWith = (order) => {
  if (order.paymentStatus !== "paid") return null;
  const label = PAYMENT_METHOD_LABELS[order.paymentMethod];
  if (!label) return "Paid online";
  const detail = order.paymentDetails?.vpaMasked || (order.paymentDetails?.cardLast4 ? `•••• ${order.paymentDetails.cardLast4}` : "");
  return `Paid with ${label}${detail ? ` (${detail})` : ""}${order.paymentDetails?.simulated ? ", test mode" : ""}`;
};

// For an order whose payment was cancelled or failed: pay for the same order.
const PayNow = ({ order, user, onPaid }) => {
  const dispatch = useDispatch();
  const [method, setMethod] = useState(() => loadCheckoutDetails(user).method);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const session = (await api.post(`/orders/${order._id}/payment-session`)).data.data;
      const result = await payForOrder({
        dispatch,
        order: { ...order, ...session.order },
        payment: session.payment,
        user,
        method,
        contactPhone: order.contactPhone,
      });
      if (result.ok) onPaid();
      else setError(result.error);
    } catch (payError) {
      setError(payError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/40 dark:bg-amber-500/10">
      <h2 className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
        <CircleAlert size={18} aria-hidden="true" /> Payment pending
      </h2>
      <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
        The restaurant starts cooking once you pay {formatCurrency(order.totalAmount)}.
      </p>
      <div className="mt-4 max-w-md">
        <PaymentMethodPicker value={method} onChange={setMethod} compact />
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="mt-4 rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
      >
        {busy ? "Opening payment…" : `Pay ${formatCurrency(order.totalAmount)} with ${PAYMENT_METHOD_LABELS[method]}`}
      </button>
    </section>
  );
};

const OrderTrackingPage = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { token, user } = useSelector((state) => state.auth);
  const { orders, activeOrder, loading } = useSelector((state) => state.orders);
  // Positions pushed by the rider over Socket.io; before the first one arrives,
  // the latest location recorded on the order is shown.
  const [socketLocation, setLiveLocation] = useState(null);

  useEffect(() => {
    dispatch(fetchOrders());
  }, [dispatch]);

  useEffect(() => {
    if (orderId) {
      dispatch(fetchOrderById(orderId));
    }
  }, [dispatch, orderId]);

  const currentOrder = (orderId && activeOrder?._id === orderId ? activeOrder : null) || activeOrder || orders[0];
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

    const onDeliveryLocation = (payload) => {
      if (payload?.orderId === activeRoomOrderId && payload?.location) {
        setLiveLocation(payload.location);
      }
    };

    socket.on("order:update", onOrderUpdate);
    socket.on("order:snapshot", onOrderUpdate);
    socket.on("delivery:location", onDeliveryLocation);

    return () => {
      socket.emit("order:leave", { orderId: activeRoomOrderId });
      socket.off("order:update", onOrderUpdate);
      socket.off("order:snapshot", onOrderUpdate);
      socket.off("delivery:location", onDeliveryLocation);
    };
  }, [token, activeRoomOrderId, dispatch]);

  const recordedLocation = useMemo(
    () =>
      [...(currentOrder?.trackingEvents || [])]
        .reverse()
        .find((event) => event.location?.lat !== undefined && event.location?.lng !== undefined)?.location || null,
    [currentOrder]
  );
  const liveLocation = socketLocation || recordedLocation;

  const refresh = () => {
    if (currentOrder?._id) dispatch(fetchOrderById(currentOrder._id));
    dispatch(fetchOrders());
  };

  if (loading && !currentOrder) {
    return <p className={card}>Loading your orders…</p>;
  }

  if (!currentOrder) {
    return (
      <div className={`${card} text-center`}>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">No orders yet</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">When you order, you can follow it here in real time.</p>
        <Link to="/restaurants" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          Browse restaurants
        </Link>
      </div>
    );
  }

  const rider = currentOrder.deliveryPartner && typeof currentOrder.deliveryPartner === "object" ? currentOrder.deliveryPartner : null;
  const isOwnOrder = String(currentOrder.user?._id || currentOrder.user) === String(user?.id || user?._id);
  const unpaid = isOwnOrder && currentOrder.status === "pending" && currentOrder.paymentStatus !== "paid";
  const hasMap =
    (currentOrder.restaurant?.address?.location || currentOrder.restaurant?.location) && currentOrder.deliveryAddress?.location;
  const otherOrders = orders.filter((order) => order._id !== currentOrder._id).slice(0, 5);

  return (
    <div className="space-y-6">
      <header className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order #{currentOrder.shortId}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {currentOrder.restaurant?.name || "Your order"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Placed {formatDateTime(currentOrder.createdAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(currentOrder.totalAmount)}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{paidWith(currentOrder) || (currentOrder.paymentStatus === "failed" ? "Payment failed" : "Not paid yet")}</p>
          </div>
        </div>
        <div className="mt-5">
          {currentOrder.status === "cancelled" ? (
            <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">This order was cancelled.</p>
          ) : (
            <OrderStatusTimeline status={currentOrder.status} />
          )}
        </div>
      </header>

      {unpaid && <PayNow order={currentOrder} user={user} onPaid={refresh} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Live tracking</h2>
          {hasMap ? (
            <MapView order={currentOrder} />
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">The map appears once the delivery address has a location.</p>
          )}
          {liveLocation && currentOrder.status === "out_for_delivery" && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Rider location updated live.</p>
          )}
        </section>

        <aside className="space-y-6">
          <section className={card}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <Bike size={18} aria-hidden="true" /> Delivery partner
            </h2>
            {rider ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{rider.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{ORDER_STATUS_LABELS[currentOrder.status]}</p>
                </div>
                {rider.phone && (
                  <a
                    href={`tel:${rider.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-200"
                  >
                    <Phone size={14} aria-hidden="true" /> Call
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {currentOrder.paymentStatus === "paid" ? "A rider is assigned as soon as one is free." : "A rider is assigned once the order is paid."}
              </p>
            )}
          </section>

          <section className={card}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Items</h2>
            <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {(currentOrder.items || []).map((item) => (
                <li key={item._id || item.menuItem} className="flex justify-between gap-3 py-2">
                  <span className="text-slate-800 dark:text-slate-200">
                    {item.quantity} × {item.name}
                  </span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            {currentOrder.discountAmount > 0 && (
              <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Saved {formatCurrency(currentOrder.discountAmount)} with {currentOrder.couponCode}
              </p>
            )}
          </section>
        </aside>
      </div>

      {otherOrders.length > 0 && (
        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Your other orders</h2>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {otherOrders.map((order) => (
              <li key={order._id}>
                <button
                  type="button"
                  onClick={() => setSearchParams({ orderId: order._id })}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-rose-700"
                >
                  <span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">#{order.shortId}</span>{" "}
                    <span className="text-slate-600 dark:text-slate-400">· {order.restaurant?.name} · {formatDateTime(order.createdAt)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {order.status === "pending" && order.paymentStatus !== "paid" ? "Payment pending" : ORDER_STATUS_LABELS[order.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default OrderTrackingPage;
