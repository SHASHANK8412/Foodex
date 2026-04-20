import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchPaymentDashboard } from "../redux/slices/adminSlice";
import { formatCurrency } from "../utils/format";

const AdminPaymentsPage = () => {
  const dispatch = useDispatch();
  const { paymentDashboard, paymentLoading } = useSelector((state) => state.admin);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    status: "",
  });

  useEffect(() => {
    dispatch(fetchPaymentDashboard(filters));
  }, [dispatch, filters]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Gross revenue",
        value: formatCurrency(paymentDashboard.summary?.grossRevenue || 0),
      },
      {
        label: "Total transactions",
        value: paymentDashboard.summary?.totalTransactions || 0,
      },
      {
        label: "Successful",
        value: paymentDashboard.summary?.successCount || 0,
      },
      {
        label: "Failed",
        value: paymentDashboard.summary?.failedCount || 0,
      },
    ],
    [paymentDashboard.summary]
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Payments command center</h1>
          <p className="text-sm text-slate-600">Centralized transaction monitoring, trend analytics and failure visibility.</p>
        </div>
        <Link
          to="/admin"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
        >
          Back to admin dashboard
        </Link>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment status
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters({ from: "", to: "", status: "" })}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reset filters
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Daily payment trend</h2>
        <p className="text-sm text-slate-500">Revenue from successful payments and total transaction attempts per day.</p>
        <div className="mt-5 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentDashboard.dailySeries || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="revenue" fill="#f97316" radius={[8, 8, 0, 0]} />
              <Bar yAxisId="right" dataKey="count" fill="#0f172a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Recent transactions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Restaurant</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Gateway Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(paymentDashboard.transactions || []).map((payment) => (
                <tr key={payment._id}>
                  <td className="px-3 py-2 text-slate-600">{new Date(payment.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{payment.order?.shortId || payment.order?._id?.slice(-8) || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{payment.user?.name || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{payment.restaurant?.name || "-"}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(payment.amount || 0)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                        payment.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : payment.status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{payment.razorpayPaymentId || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paymentLoading && <p className="mt-3 text-sm text-slate-500">Refreshing payment analytics...</p>}
      </section>
    </div>
  );
};

export default AdminPaymentsPage;
