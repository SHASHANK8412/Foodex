import { formatCurrency, formatDateTime } from "../../utils/format";

const PartnerOrderCard = ({ order, actionLoading, onStatusChange, onAccept, onReject, onView, onInvoice }) => {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Order {order.shortId || order._id.slice(-8)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(order.createdAt)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {order.status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
        <p>Customer: {order.user?.name || "-"}</p>
        <p>Items: {(order.items || []).length}</p>
        <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(order.totalAmount || 0)}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={actionLoading || order.status !== "pending"}
          onClick={() => onAccept(order)}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={actionLoading || order.status !== "pending"}
          onClick={() => onReject(order)}
          className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
        >
          Reject
        </button>
        <select
          value={order.status}
          onChange={(event) => onStatusChange(order, event.target.value)}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          {["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onView(order)}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => onInvoice(order)}
          className="rounded-full border border-orange-300 bg-orange-50 px-4 py-1.5 text-xs font-semibold text-orange-700"
        >
          Invoice PDF
        </button>
      </div>
    </article>
  );
};

export default PartnerOrderCard;
