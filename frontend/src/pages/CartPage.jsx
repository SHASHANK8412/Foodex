import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import CartItem from "../components/CartItem";
import { formatCurrency } from "../utils/format";

const CartPage = () => {
  const navigate = useNavigate();
  const { items } = useSelector((state) => state.cart);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05;
  const deliveryFee = items.length ? 40 : 0;
  const total = subtotal + tax + deliveryFee;

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

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Bill summary</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tax</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Delivery fee</span>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
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
      </aside>
    </div>
  );
};

export default CartPage;
