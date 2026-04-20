import { formatCurrency, formatDateTime } from "../../utils/format";

const PartnerBillingTable = ({ rows, onDownloadInvoice, onLoadInvoice }) => {
  if (!rows.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-300">No billing rows yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Order</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Invoice</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((order) => (
            <tr key={order._id}>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDateTime(order.createdAt)}</td>
              <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">{order.shortId || order._id.slice(-8)}</td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{order.status}</td>
              <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(order.totalAmount || 0)}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadInvoice(order._id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    View Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadInvoice(order._id)}
                    className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"
                  >
                    Download
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PartnerBillingTable;
