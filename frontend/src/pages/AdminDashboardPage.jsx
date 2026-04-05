import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  assignDeliveryPartner,
  createDeliveryPartner,
  fetchDeliveryPartners,
  updateOrderStatus,
} from "../redux/slices/adminSlice";
import { fetchOrders } from "../redux/slices/orderSlice";
import { formatCurrency } from "../utils/format";

const AdminDashboardPage = () => {
  const dispatch = useDispatch();
  const { orders } = useSelector((state) => state.orders);
  const { partners, error } = useSelector((state) => state.admin);

  const [partnerForm, setPartnerForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    dispatch(fetchOrders());
    dispatch(fetchDeliveryPartners());
  }, [dispatch]);

  const stats = useMemo(() => {
    const total = orders.length;
    const active = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;
    const revenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    return { total, active, revenue };
  }, [orders]);

  const handleCreatePartner = async (event) => {
    event.preventDefault();
    await dispatch(createDeliveryPartner(partnerForm));
    setPartnerForm({ name: "", email: "", phone: "", password: "" });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin dashboard</h1>
        <p className="text-sm text-slate-600">Manage operations, riders and order lifecycle.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total orders</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{stats.total}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active orders</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{stats.active}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Revenue</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{formatCurrency(stats.revenue)}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Create delivery partner</h2>
          <form className="mt-4 grid gap-3" onSubmit={handleCreatePartner}>
            <input
              value={partnerForm.name}
              onChange={(event) => setPartnerForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              placeholder="Name"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
            />
            <input
              value={partnerForm.email}
              onChange={(event) => setPartnerForm((prev) => ({ ...prev, email: event.target.value }))}
              type="email"
              required
              placeholder="Email"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
            />
            <input
              value={partnerForm.phone}
              onChange={(event) => setPartnerForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Phone"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
            />
            <input
              value={partnerForm.password}
              onChange={(event) => setPartnerForm((prev) => ({ ...prev, password: event.target.value }))}
              type="password"
              required
              placeholder="Password"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
            />
            <button type="submit" className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              Add partner
            </button>
          </form>
          {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Delivery partners</h2>
          <ul className="mt-4 space-y-2">
            {partners.map((partner) => (
              <li key={partner.id || partner._id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-900">{partner.name}</p>
                <p className="text-slate-500">{partner.email}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Manage orders</h2>
        <div className="mt-4 space-y-4">
          {orders.map((order) => (
            <article key={order._id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Order {order._id.slice(-8)}</p>
                <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">{order.status}</p>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <select
                  value={assignments[order._id]?.deliveryPartnerId || ""}
                  onChange={(event) =>
                    setAssignments((prev) => ({
                      ...prev,
                      [order._id]: { ...(prev[order._id] || {}), deliveryPartnerId: event.target.value },
                    }))
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select partner</option>
                  {partners.map((partner) => (
                    <option key={partner.id || partner._id} value={partner.id || partner._id}>
                      {partner.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const selected = assignments[order._id]?.deliveryPartnerId;
                    if (selected) {
                      dispatch(assignDeliveryPartner({ orderId: order._id, deliveryPartnerId: selected }));
                    }
                  }}
                  className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700"
                >
                  Assign delivery
                </button>

                <select
                  value={assignments[order._id]?.status || order.status}
                  onChange={(event) => {
                    const status = event.target.value;
                    setAssignments((prev) => ({
                      ...prev,
                      [order._id]: { ...(prev[order._id] || {}), status },
                    }));
                    dispatch(updateOrderStatus({ orderId: order._id, status, note: "Admin updated status" }));
                  }}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
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
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
