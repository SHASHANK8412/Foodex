import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Clock, MapPin, ShieldCheck } from "lucide-react";
import { clearCart } from "../redux/slices/cartSlice";
import { createOrder } from "../redux/slices/orderSlice";
import { fetchDeliveryEstimate } from "../redux/slices/analyticsSlice";
import { payForOrder } from "../services/checkoutFlow";
import { formatCurrency } from "../utils/format";
import useQuote from "../hooks/useQuote";
import { track } from "../services/tracker";
import BillSummary from "../components/BillSummary";
import PaymentMethodPicker from "../components/PaymentMethodPicker";
import { PAYMENT_METHOD_LABELS } from "../utils/paymentMethods";
import { loadCheckoutDetails, saveCheckoutDetails, isValidIndianMobile } from "../utils/checkoutDetails";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-rose-300 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const card = "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900";

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
  </label>
);

const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, couponCode } = useSelector((state) => state.cart);
  const { user } = useSelector((state) => state.auth);
  const { loading, error } = useSelector((state) => state.orders);
  const { deliveryEstimate } = useSelector((state) => state.analytics);

  const [details, setDetails] = useState(() => loadCheckoutDetails(user));
  const [paymentError, setPaymentError] = useState("");
  const [paying, setPaying] = useState(false);
  // An order created by an earlier attempt whose payment did not complete:
  // retries pay for it instead of creating another order.
  const [unpaid, setUnpaid] = useState(null);
  const cartKey = JSON.stringify(items.map((item) => [item.menuItemId, item.quantity]));

  const { quote, error: quoteError } = useQuote(items, couponCode);
  // An invalid coupon is not sent: the customer removes it in the cart first.
  const appliedCoupon = quote?.coupon?.valid ? quote.coupon.code : undefined;

  const cartRestaurantId = items[0]?.restaurantId;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (cartRestaurantId) {
      track("checkout_started", { path: "/checkout", restaurantId: cartRestaurantId });
    }
  }, [cartRestaurantId]);

  useEffect(() => {
    if (!cartRestaurantId) {
      return;
    }
    dispatch(
      fetchDeliveryEstimate({ restaurantId: cartRestaurantId, itemCount, distanceKm: 4, hourOfDay: new Date().getHours() })
    );
  }, [dispatch, cartRestaurantId, itemCount]);

  const update = (field) => (event) => setDetails((previous) => ({ ...previous, [field]: event.target.value }));
  const phoneValid = isValidIndianMobile(details.phone);

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    setPaymentError("");
    if (!items.length || !phoneValid) {
      return;
    }

    setPaying(true);
    saveCheckoutDetails(details);
    const address = { line1: details.line1, city: details.city, state: details.state, postalCode: details.postalCode };

    try {
      let attempt = unpaid?.cartKey === cartKey ? unpaid : null;
      if (!attempt) {
        const result = await dispatch(
          createOrder({
            restaurantId: cartRestaurantId,
            items: items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
            deliveryAddress: address,
            couponCode: appliedCoupon,
            contactPhone: details.phone,
          })
        );
        if (!result.payload?.order) {
          return;
        }
        attempt = { ...result.payload, cartKey };
      }

      const { order, payment } = attempt;
      const paid = await payForOrder({ dispatch, order, payment, user, method: details.method, contactPhone: details.phone });
      if (!paid.ok) {
        setUnpaid(attempt);
        setPaymentError(`${paid.error}. Your order #${order.shortId} is saved: pay again here, or later from Track order.`);
        return;
      }

      dispatch(clearCart());
      navigate("/order-confirmation?orderId=" + order._id);
    } finally {
      setPaying(false);
    }
  };

  if (!items.length) {
    return (
      <div className={`${card} text-center`}>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Your cart is empty</h1>
        <Link to="/restaurants" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          Browse restaurants
        </Link>
      </div>
    );
  }

  const busy = loading || paying;
  const retrying = unpaid?.cartKey === cartKey;
  const payLabel = quote
    ? `${retrying ? "Try again: pay" : "Pay"} ${formatCurrency(quote.totalAmount)} with ${PAYMENT_METHOD_LABELS[details.method] || "Razorpay"}`
    : "Calculating total…";

  return (
    <form onSubmit={handlePlaceOrder} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Checkout</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Where should we deliver, and how would you like to pay?</p>
        </header>

        <section className={`${card} space-y-4`}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <MapPin size={18} aria-hidden="true" /> Delivery address
          </h2>
          <Field label="House, street and area">
            <input required autoComplete="street-address" value={details.line1} onChange={update("line1")} placeholder="Flat 4B, 12 MG Road" className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City">
              <input required autoComplete="address-level2" value={details.city} onChange={update("city")} className={inputClass} />
            </Field>
            <Field label="State">
              <input required autoComplete="address-level1" value={details.state} onChange={update("state")} className={inputClass} />
            </Field>
            <Field label="PIN code">
              <input
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{5}"
                title="6-digit PIN code"
                autoComplete="postal-code"
                value={details.postalCode}
                onChange={update("postalCode")}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Mobile number" hint="For the rider, and to open UPI payment straight away.">
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                +91
              </span>
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                value={details.phone}
                onChange={update("phone")}
                placeholder="98765 43210"
                aria-invalid={Boolean(details.phone) && !phoneValid}
                className={`${inputClass} rounded-l-none`}
              />
            </div>
          </Field>
          {details.phone && !phoneValid && <p className="text-xs font-semibold text-rose-700">Enter a 10-digit mobile number starting with 6, 7, 8 or 9.</p>}
        </section>

        <section className={card}>
          <PaymentMethodPicker value={details.method} onChange={(method) => setDetails((previous) => ({ ...previous, method }))} />
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={14} aria-hidden="true" /> Payments are processed by Razorpay. Foodex never sees your UPI PIN or card number.
          </p>
        </section>
      </div>

      <aside className={`${card} h-fit space-y-4 lg:sticky lg:top-24`}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Your order</h2>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {items.map((item) => (
            <li key={item.menuItemId} className="flex justify-between gap-3 py-2">
              <span className="text-slate-800 dark:text-slate-200">
                {item.quantity} × {item.name}
              </span>
              <span className="tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <BillSummary quote={quote} loading={!quote && !quoteError} error={quoteError} />
        {quote?.discount > 0 && (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            You save {formatCurrency(quote.discount)} with {quote.coupon.code}
          </p>
        )}
        {deliveryEstimate?.estimatedMinutes && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Clock size={16} aria-hidden="true" /> Arrives in about {deliveryEstimate.estimatedMinutes} min
          </p>
        )}
        {(error || paymentError) && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">
            {paymentError || error}
          </p>
        )}
        <button
          disabled={busy || !quote || !phoneValid}
          type="submit"
          className="w-full rounded-full bg-rose-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Opening payment…" : payLabel}
        </button>
      </aside>
    </form>
  );
};

export default CheckoutPage;
