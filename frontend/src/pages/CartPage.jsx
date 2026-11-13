import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import CartItem from "../components/CartItem";
import BillSummary from "../components/BillSummary";
import FrequentlyBoughtTogether from "../components/FrequentlyBoughtTogether";
import useQuote from "../hooks/useQuote";
import { setCouponCode } from "../redux/slices/cartSlice";

const CartPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items, couponCode } = useSelector((state) => state.cart);
  const [couponInput, setCouponInput] = useState(couponCode);
  const { quote, loading, error } = useQuote(items, couponCode);

  const applyCoupon = (event) => {
    event.preventDefault();
    dispatch(setCouponCode(couponInput));
  };

  const removeCoupon = () => {
    setCouponInput("");
    dispatch(setCouponCode(""));
  };

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Your cart is empty</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Add delicious items from restaurants to continue.</p>
        <Link to="/restaurants" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          Browse restaurants
        </Link>
      </div>
    );
  }

  const coupon = quote?.coupon;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Cart</h1>
        {items.map((item) => (
          <CartItem key={item.menuItemId} item={item} />
        ))}
        <FrequentlyBoughtTogether items={items} />
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Bill summary</h2>
        <form className="mt-4 flex gap-2" onSubmit={applyCoupon}>
          <label htmlFor="coupon-code" className="sr-only">
            Coupon code
          </label>
          <input
            id="coupon-code"
            value={couponInput}
            onChange={(event) => setCouponInput(event.target.value)}
            placeholder="Coupon code"
            autoComplete="off"
            className="w-full rounded-full border border-slate-300 px-3 py-2 text-xs uppercase dark:border-slate-700 dark:bg-slate-950"
          />
          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
            Apply
          </button>
        </form>

        {coupon?.valid && (
          <p className="mt-2 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span>
              {coupon.code} applied: {coupon.title}
            </span>
            <button type="button" onClick={removeCoupon} className="underline">
              Remove
            </button>
          </p>
        )}
        {coupon && !coupon.valid && (
          <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-400" role="alert">
            {coupon.code}: {coupon.reason}
          </p>
        )}

        <BillSummary quote={quote} loading={loading} error={error} />

        <button
          type="button"
          onClick={() => navigate("/checkout")}
          disabled={!quote || Boolean(coupon && !coupon.valid)}
          className="mt-5 w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Proceed to checkout
        </button>
        {coupon && !coupon.valid && (
          <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Remove the coupon to continue.</p>
        )}
      </aside>
    </div>
  );
};

export default CartPage;
