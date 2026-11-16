import { formatCurrency } from "../utils/format";

// The bill as priced by the server. Shown on the cart and checkout pages.
const BillSummary = ({ quote, loading, error }) => {
  if (error) {
    return <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>;
  }

  if (!quote) {
    return <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{loading ? "Calculating your bill…" : ""}</p>;
  }

  const rows = [
    ["Subtotal", formatCurrency(quote.subtotal)],
    [`Tax (${Math.round(quote.taxRate * 100)}%)`, formatCurrency(quote.taxAmount)],
    ["Delivery fee", quote.deliveryFee === 0 ? "Free" : formatCurrency(quote.deliveryFee)],
  ];

  return (
    <div className={`mt-4 space-y-2 text-sm transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>{label}</span>
          <span className="tabular-nums">{value}</span>
        </div>
      ))}
      {quote.discount > 0 && (
        <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400">
          <span>Coupon {quote.coupon?.code}</span>
          <span className="tabular-nums">-{formatCurrency(quote.discount)}</span>
        </div>
      )}
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(quote.totalAmount)}</span>
      </div>
    </div>
  );
};

export default BillSummary;
