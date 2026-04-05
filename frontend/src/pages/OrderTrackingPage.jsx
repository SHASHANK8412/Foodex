import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { fetchOrderById, fetchOrders, setActiveOrderFromSocket } from "../redux/slices/orderSlice";
import OrderStatusTimeline from "../components/OrderStatusTimeline";
import { connectSocket, disconnectSocket } from "../services/socket";
import { formatCurrency, formatDateTime } from "../utils/format";

const OrderTrackingPage = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { token } = useSelector((state) => state.auth);
  const { orders, activeOrder, loading } = useSelector((state) => state.orders);

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

    if (orderId) {
      socket.emit("order:join", { orderId });
    }

    const onOrderUpdate = (payload) => {
      if (payload?.order) {
        dispatch(setActiveOrderFromSocket(payload.order));
      }
    };

    socket.on("order:update", onOrderUpdate);

    return () => {
      if (orderId) {
        socket.emit("order:leave", { orderId });
      }
      socket.off("order:update", onOrderUpdate);
      disconnectSocket();
    };
  }, [token, orderId, dispatch]);

  const currentOrder = activeOrder || orders[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Order tracking</h1>
        <p className="text-sm text-slate-600">Watch status changes in real time.</p>
      </div>

      {loading && <p className="rounded-2xl bg-white p-6">Loading orders...</p>}

      {currentOrder ? (
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Order ID</p>
              <p className="font-mono text-sm font-semibold text-slate-900">{currentOrder._id}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-xl font-black text-slate-900">{formatCurrency(currentOrder.totalAmount)}</p>
            </div>
          </div>

          <OrderStatusTimeline status={currentOrder.status} />

          <div className="rounded-2xl bg-slate-50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Tracking events</h2>
            <ul className="mt-3 space-y-2">
              {(currentOrder.trackingEvents || []).map((event, index) => (
                <li key={index} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{event.status}</p>
                  <p className="text-xs text-slate-500">{event.note || "Status update"}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(event.timestamp)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">No orders found yet.</p>
      )}
    </div>
  );
};

export default OrderTrackingPage;
