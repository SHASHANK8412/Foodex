import { Building2, CreditCard, Smartphone, Wallet } from "lucide-react";

// How the customer wants to pay. Razorpay Checkout opens on this method (the
// others stay available inside it). UPI is first: it is how most people in
// India pay online.
const OPTIONS = [
  {
    id: "upi",
    label: "UPI",
    hint: "Google Pay, PhonePe, Paytm, BHIM. Scan a QR code on a computer, or open your UPI app on a phone.",
    Icon: Smartphone,
    badge: "Recommended",
  },
  { id: "card", label: "Credit or debit card", hint: "Visa, Mastercard, RuPay, Amex", Icon: CreditCard },
  { id: "netbanking", label: "Netbanking", hint: "All major banks", Icon: Building2 },
  { id: "wallet", label: "Wallets", hint: "Paytm, PhonePe, Amazon Pay and more", Icon: Wallet },
];

const PaymentMethodPicker = ({ value, onChange, compact = false }) => (
  <fieldset className="space-y-2">
    <legend className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Pay with</legend>
    {OPTIONS.map((option) => {
      const { id, label, hint, badge } = option;
      const Icon = option.Icon;
      const selected = value === id;
      return (
        <label
          key={id}
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
            selected
              ? "border-rose-400 bg-rose-50 ring-1 ring-rose-300 dark:border-rose-500 dark:bg-rose-500/10"
              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
          }`}
        >
          <input
            type="radio"
            name="payment-method"
            value={id}
            checked={selected}
            onChange={() => onChange(id)}
            className="mt-1 accent-rose-500"
          />
          <Icon size={20} aria-hidden="true" className={`mt-0.5 shrink-0 ${selected ? "text-rose-600" : "text-slate-500"}`} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {label}
              {badge && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {badge}
                </span>
              )}
            </span>
            {(!compact || selected) && <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{hint}</span>}
          </span>
        </label>
      );
    })}
  </fieldset>
);

export default PaymentMethodPicker;
