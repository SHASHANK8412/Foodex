import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useSelector } from "react-redux";
import CartItem from "../components/CartItem";
import { formatCurrency } from "../utils/format";

const CartPage = () => {
  const navigate = useNavigate();
  const { items } = useSelector((state) => state.cart);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05;
  const deliveryFee = items.length ? 40 : 0;
  const discountRate = appliedCoupon === "FOODEX30" ? 0.3 : appliedCoupon === "FASTFREE" ? 0.08 : 0;
  const discount = subtotal * discountRate;
  const total = subtotal + tax + deliveryFee - discount;

  const applyCoupon = () => {
    const normalized = coupon.trim().toUpperCase();
    if (["FOODEX30", "FASTFREE"].includes(normalized)) {
      setAppliedCoupon(normalized);
    } else {
      setAppliedCoupon("");
    }
  };

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-2xl font-black text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-slate-600">Add delicious items from restaurants to continue.</p>
        <Link to="/restaurants" className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          Browse restaurants
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-3">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Cart</h1>
        {items.map((item) => (
          <CartItem key={item.menuItemId} item={item} />
        ))}
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Bill summary</h2>
        <div className="mt-4 flex gap-2">
          <input
            value={coupon}
            onChange={(event) => setCoupon(event.target.value)}
            placeholder="Coupon code"
            className="w-full rounded-full border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            onClick={applyCoupon}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
          >
            Apply
          </button>
        </div>
        {!!appliedCoupon && <p className="mt-2 text-xs font-semibold text-emerald-600">Coupon {appliedCoupon} applied</p>}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Tax</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Delivery fee</span>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
          <div className="flex justify-between text-emerald-600">
            <span>Discount</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/checkout")}
          className="mt-5 w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600"
        >
          Proceed to checkout
        </button>

        <div className="mt-5 space-y-2 rounded-2xl bg-amber-50 p-3 dark:bg-slate-800">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Recommended add-ons</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">Garlic bread, soft drinks and dessert combos pair well with your cart.</p>
        </div>
      </aside>
    </div>
  );
};

export default CartPage;
