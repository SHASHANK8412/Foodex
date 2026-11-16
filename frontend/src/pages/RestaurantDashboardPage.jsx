import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { addToast } from "../redux/slices/uiSlice";
import {
  clearPartnerError,
  clearPartnerNotifications,
  fetchPartnerDashboard,
  fetchPartnerInvoice,
  fetchPartnerOrders,
  markPartnerNotificationRead,
  setRealtimeOrderUpdate,
  updatePartnerOrderStatus,
} from "../redux/slices/partnerSlice";
import { formatCurrency, formatDateTime } from "../utils/format";
import PartnerTopbar from "../components/partner/PartnerTopbar";
import PartnerOrderCard from "../components/partner/PartnerOrderCard";
import PartnerBillingTable from "../components/partner/PartnerBillingTable";
import PartnerReviewsPanel from "../components/partner/PartnerReviewsPanel";

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Orders" },
  { key: "menu", label: "Menu" },
  { key: "billing", label: "Billing" },
  { key: "analytics", label: "Analytics" },
  { key: "reviews", label: "Reviews" },
  { key: "settings", label: "Settings" },
];

const RestaurantDashboardPage = () => {
  const dispatch = useDispatch();
  const token = localStorage.getItem("foodex_token") || "";

  const { dashboard, orders, invoiceByOrder, loading, ordersLoading, actionLoading, error, notifications } =
    useSelector((state) => state.partner);
  const { user } = useSelector((state) => state.auth);

  const [activeSection, setActiveSection] = useState("dashboard");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [invoicePreviewOrderId, setInvoicePreviewOrderId] = useState("");
  const [responseDrafts, setResponseDrafts] = useState({});
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchPartnerDashboard());
    dispatch(fetchPartnerOrders());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedRestaurant && dashboard.restaurants?.[0]?._id) {
      setSelectedRestaurant(dashboard.restaurants[0]._id);
    }
  }, [dashboard.restaurants, selectedRestaurant]);

  useEffect(() => {
    if (!token || !dashboard.restaurants?.length) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    dashboard.restaurants.forEach((restaurant) => {
      socket.emit("owner:restaurant:join", { restaurantId: restaurant._id });
    });

    const onOwnerOrderUpdate = (payload) => {
      if (!payload?.order) {
        return;
      }

      dispatch(setRealtimeOrderUpdate(payload.order));
      dispatch(
        addToast({
          type: "info",
          message: payload.message || `Order ${payload.order.shortId || payload.order._id.slice(-8)} updated`,
        })
      );
    };

    socket.on("owner:order:update", onOwnerOrderUpdate);

    return () => {
      dashboard.restaurants.forEach((restaurant) => {
        socket.emit("owner:restaurant:leave", { restaurantId: restaurant._id });
      });
      socket.off("owner:order:update", onOwnerOrderUpdate);
      disconnectSocket();
    };
  }, [token, dashboard.restaurants, dispatch]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!token) {
        return;
      }

      setReviewsLoading(true);
      try {
        const params = selectedRestaurant ? { restaurantId: selectedRestaurant } : {};
        const response = await api.get("/reviews/owner", { params });
        setReviews(response.data?.data || []);
      } catch (error) {
        dispatch(addToast({ type: "error", message: error.message || "Failed to load reviews" }));
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [token, selectedRestaurant, dispatch]);

  const filteredOrders = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return orders.filter((order) => {
      const restaurantId = order.restaurant?._id || order.restaurant;
      const matchesRestaurant = !selectedRestaurant || String(restaurantId) === String(selectedRestaurant);
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const matchesSearch =
        !searchValue ||
        (order.shortId || "").toLowerCase().includes(searchValue) ||
        (order.deliveryAddress?.line1 || "").toLowerCase().includes(searchValue) ||
        (order.user?.name || "").toLowerCase().includes(searchValue);

      return matchesRestaurant && matchesStatus && matchesSearch;
    });
  }, [orders, selectedRestaurant, statusFilter, search]);

  const billingRows = useMemo(() => {
    return [...filteredOrders]
      .filter((order) => ["confirmed", "preparing", "out_for_delivery", "delivered"].includes(order.status))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filteredOrders]);

  const analyticsData = useMemo(() => {
    const safeOrders = filteredOrders.length ? filteredOrders : orders;

    const byDay = new Map();
    const byWeek = new Map();
    const byMonth = new Map();
    const hourMap = new Map();

    safeOrders.forEach((order) => {
      if (!["confirmed", "preparing", "out_for_delivery", "delivered"].includes(order.status)) {
        return;
      }

      const date = new Date(order.createdAt);
      const day = date.toISOString().slice(0, 10);
      const week = `${date.getUTCFullYear()}-W${Math.ceil((date.getUTCDate() + new Date(date.getUTCFullYear(), date.getUTCMonth(), 1).getDay()) / 7)}`;
      const month = date.toISOString().slice(0, 7);
      const hour = date.getHours();

      byDay.set(day, (byDay.get(day) || 0) + (order.totalAmount || 0));
      byWeek.set(week, (byWeek.get(week) || 0) + (order.totalAmount || 0));
      byMonth.set(month, (byMonth.get(month) || 0) + (order.totalAmount || 0));
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    const dailyRevenue = Array.from(byDay.entries())
      .map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-7);

    const weeklyRevenue = Array.from(byWeek.entries())
      .map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-8);

    const monthlyRevenue = Array.from(byMonth.entries())
      .map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-6);

    const peakHours = Array.from(hourMap.entries())
      .map(([hour, ordersCount]) => ({ hour: `${String(hour).padStart(2, "0")}:00`, ordersCount }))
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);

    return { dailyRevenue, weeklyRevenue, monthlyRevenue, peakHours };
  }, [filteredOrders, orders]);

  const ratingsBreakdown = useMemo(() => {
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      breakdown[review.rating] = (breakdown[review.rating] || 0) + 1;
    });
    return breakdown;
  }, [reviews]);

  const activeInvoice = invoiceByOrder[invoicePreviewOrderId] || null;

  const handleStatusChange = async (order, status, note) => {
    const resolvedStatus = status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : status;

    const result = await dispatch(
      updatePartnerOrderStatus({
        orderId: order._id,
        status: resolvedStatus,
        note: note || "Status updated from partner panel",
      })
    );

    if (updatePartnerOrderStatus.fulfilled.match(result)) {
      dispatch(addToast({ type: "success", message: "Order status updated" }));
      if (["accepted", "confirmed"].includes(resolvedStatus)) {
        dispatch(fetchPartnerInvoice(order._id));
      }
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      const response = await api.get(`/owner/orders/${orderId}/invoice/pdf`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `invoice-${orderId.slice(-8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (downloadError) {
      dispatch(addToast({ type: "error", message: downloadError.message || "Failed to download invoice" }));
    }
  };

  const handleLoadInvoice = async (orderId) => {
    await dispatch(fetchPartnerInvoice(orderId));
    setInvoicePreviewOrderId(orderId);
  };

  const handlePrintInvoice = () => {
    if (!activeInvoice) {
      return;
    }

    const printable = window.open("", "_blank", "width=900,height=700");
    if (!printable) {
      return;
    }

    const rows = (activeInvoice.items || [])
      .map((item) => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>Rs ${Number(item.unitPrice || 0).toFixed(2)}</td><td>Rs ${Number(item.lineTotal || 0).toFixed(2)}</td></tr>`)
      .join("");

    printable.document.write(`
      <html>
        <head><title>${activeInvoice.invoiceNumber}</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
          <h2>Foodex Invoice</h2>
          <p><strong>Invoice:</strong> ${activeInvoice.invoiceNumber}</p>
          <p><strong>Generated:</strong> ${new Date(activeInvoice.generatedAt).toLocaleString()}</p>
          <table border="1" cellspacing="0" cellpadding="8" width="100%">
            <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="text-align:right;margin-top:16px;"><strong>Subtotal:</strong> Rs ${Number(activeInvoice.subtotal || 0).toFixed(2)}</p>
          <p style="text-align:right;"><strong>Tax:</strong> Rs ${Number(activeInvoice.taxAmount || 0).toFixed(2)}</p>
          <p style="text-align:right;"><strong>Delivery:</strong> Rs ${Number(activeInvoice.deliveryCharges || 0).toFixed(2)}</p>
          <p style="text-align:right;font-size:18px;"><strong>Total:</strong> Rs ${Number(activeInvoice.totalAmount || 0).toFixed(2)}</p>
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  const handleReviewRespond = async (reviewId, response) => {
    if (!response.trim()) {
      return;
    }

    try {
      const replyResponse = await api.patch(`/reviews/${reviewId}/respond`, { response: response.trim() });
      const updated = replyResponse.data?.data;

      setReviews((prev) =>
        prev.map((review) => (review._id === reviewId || review.id === reviewId ? updated : review))
      );

      setResponseDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      dispatch(addToast({ type: "success", message: "Response posted" }));
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message || "Failed to post response" }));
    }
  };

  const pendingOrders = filteredOrders.filter((order) => order.status === "pending").length;

  const renderDashboard = () => (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Orders today</p>
          <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{dashboard.kpis?.ordersToday || 0}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending queue</p>
          <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{pendingOrders}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Revenue</p>
          <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(dashboard.kpis?.revenue || 0)}</p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Most popular items</h3>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(dashboard.topDishes || []).map((dish) => (
            <div key={dish._id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{dish._id}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sold qty: {dish.qty}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Notifications</h3>
        <div className="mt-3 space-y-2">
          {notifications.slice(0, 6).map((notification) => (
            <div key={notification.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notification.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{notification.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch(markPartnerNotificationRead(notification.id))}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Dismiss
              </button>
            </div>
          ))}
          {!notifications.length && <p className="text-sm text-slate-500 dark:text-slate-300">No unread alerts.</p>}
        </div>
      </section>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by short id, address, customer"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">All statuses</option>
            {[
              "pending",
              "confirmed",
              "preparing",
              "out_for_delivery",
              "delivered",
              "cancelled",
            ].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => dispatch(fetchPartnerOrders({ status: statusFilter, search }))}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setSearch("");
              dispatch(fetchPartnerOrders());
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Clear
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {ordersLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <PartnerOrderCard
              key={order._id}
              order={order}
              actionLoading={actionLoading}
              onStatusChange={(targetOrder, status) => handleStatusChange(targetOrder, status)}
              onAccept={(targetOrder) => handleStatusChange(targetOrder, "accepted", "Order accepted")}
              onReject={(targetOrder) => handleStatusChange(targetOrder, "rejected", "Order rejected")}
              onView={setSelectedOrder}
              onInvoice={(targetOrder) => handleDownloadInvoice(targetOrder._id)}
            />
          ))
        )}
      </section>
    </div>
  );

  const renderMenu = () => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Menu Management</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
        Add, edit, delete, categorize and toggle availability. Image upload is integrated via your Cloudinary-backed menu flow.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {(dashboard.restaurants || []).map((restaurant) => (
          <Link
            key={restaurant._id}
            to={`/restaurant/${restaurant._id}/menu`}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Manage {restaurant.name}
          </Link>
        ))}
      </div>
    </section>
  );

  const renderBilling = () => (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Billing History</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Order-wise invoice records with PDF download and print support.</p>
        <div className="mt-4">
          <PartnerBillingTable
            rows={billingRows}
            onDownloadInvoice={handleDownloadInvoice}
            onLoadInvoice={handleLoadInvoice}
          />
        </div>
      </section>

      {activeInvoice && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">Invoice {activeInvoice.invoiceNumber}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-300">Generated {formatDateTime(activeInvoice.generatedAt)}</p>
            </div>
            <button
              type="button"
              onClick={handlePrintInvoice}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
            >
              Print invoice
            </button>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            {(activeInvoice.items || []).map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="text-slate-700 dark:text-slate-200">{item.name} x {item.quantity}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.lineTotal || 0)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-right text-sm">
            <p className="text-slate-600 dark:text-slate-300">Subtotal: {formatCurrency(activeInvoice.subtotal || 0)}</p>
            <p className="text-slate-600 dark:text-slate-300">Tax: {formatCurrency(activeInvoice.taxAmount || 0)}</p>
            <p className="text-slate-600 dark:text-slate-300">Delivery: {formatCurrency(activeInvoice.deliveryCharges || 0)}</p>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">Total: {formatCurrency(activeInvoice.totalAmount || 0)}</p>
          </div>
        </section>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Daily Revenue</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Peak Hours</h3>
          <div className="mt-3 space-y-2">
            {analyticsData.peakHours.map((slot) => (
              <div key={slot.hour} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{slot.hour}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Orders: {slot.ordersCount}</p>
              </div>
            ))}
            {!analyticsData.peakHours.length && <p className="text-sm text-slate-500 dark:text-slate-300">No peak hour data.</p>}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Weekly Revenue</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.weeklyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Monthly Revenue</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#16a34a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );

  const renderReviews = () => (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Ratings Breakdown</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="rounded-xl border border-slate-200 px-3 py-2 text-center dark:border-slate-700">
              <p className="text-sm font-bold text-amber-600">{star}★</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ratingsBreakdown[star] || 0} reviews</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Customer Reviews</h3>
        <div className="mt-4">
          {reviewsLoading && <p className="mb-3 text-sm text-slate-500 dark:text-slate-300">Loading reviews...</p>}
          <PartnerReviewsPanel
            reviews={reviews}
            onRespond={handleReviewRespond}
            responseDrafts={responseDrafts}
            setResponseDrafts={setResponseDrafts}
          />
        </div>
      </section>
    </div>
  );

  const renderSettings = () => (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Settings</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
        Configure operational preferences, notification behavior, and promotions.
      </p>
      <div className="mt-4 space-y-2">
        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Enable realtime alerts</span>
          <input type="checkbox" defaultChecked className="h-4 w-4" />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Auto-refresh billing history</span>
          <input type="checkbox" defaultChecked className="h-4 w-4" />
        </label>
      </div>
    </section>
  );

  const renderSection = () => {
    if (activeSection === "dashboard") return renderDashboard();
    if (activeSection === "orders") return renderOrders();
    if (activeSection === "menu") return renderMenu();
    if (activeSection === "billing") return renderBilling();
    if (activeSection === "analytics") return renderAnalytics();
    if (activeSection === "reviews") return renderReviews();
    return renderSettings();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
          <button
            type="button"
            onClick={() => dispatch(clearPartnerError())}
            className="ml-3 rounded-full border border-rose-300 px-2 py-0.5 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <PartnerTopbar
        selectedRestaurant={selectedRestaurant}
        restaurants={dashboard.restaurants || []}
        notificationsCount={notifications.length}
        onRestaurantChange={setSelectedRestaurant}
        user={user}
      />

      <div className="grid gap-6 lg:grid-cols-[250px,1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="px-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Owner</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name || "Partner"}</p>
          </div>
          <nav className="mt-4 space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  activeSection === item.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => dispatch(clearPartnerNotifications())}
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            Clear alerts
          </button>
        </aside>

        <main className="space-y-5">{renderSection()}</main>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Order {selectedOrder.shortId || selectedOrder._id.slice(-8)}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Placed {formatDateTime(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedOrder.user?.name || "-"}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{selectedOrder.user?.phone || "No phone"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Address</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  {selectedOrder.deliveryAddress?.line1 || "-"}, {selectedOrder.deliveryAddress?.city || "-"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
              <ul className="mt-3 space-y-2">
                {(selectedOrder.items || []).map((item, index) => (
                  <li key={`${item.menuItem || item.name}-${index}`} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">
                      {item.name} x {item.quantity}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.quantity * item.price)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-slate-200 pt-3 text-right dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-300">Total</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedOrder.totalAmount || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboardPage;
