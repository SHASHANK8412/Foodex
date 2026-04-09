import { useDispatch } from "react-redux";
import { removeFromCart, updateQuantity } from "../redux/slices/cartSlice";
import { formatCurrency } from "../utils/format";
import { addToast } from "../redux/slices/uiSlice";

const CartItem = ({ item }) => {
  const dispatch = useDispatch();

  return (
    <article className="grid grid-cols-[1fr_auto] gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h4 className="font-bold text-slate-900 dark:text-slate-100">{item.name}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(item.price)} each</p>
        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.price * item.quantity)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            dispatch(updateQuantity({ menuItemId: item.menuItemId, quantity: item.quantity - 1 }));
            dispatch(addToast({ message: `${item.name} quantity updated` }));
          }}
          className="h-8 w-8 rounded-full border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
        >
          -
        </button>
        <span className="w-6 text-center text-sm font-semibold dark:text-slate-100">{item.quantity}</span>
        <button
          type="button"
          onClick={() => {
            dispatch(updateQuantity({ menuItemId: item.menuItemId, quantity: item.quantity + 1 }));
            dispatch(addToast({ message: `${item.name} quantity updated` }));
          }}
          className="h-8 w-8 rounded-full border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch(removeFromCart(item.menuItemId));
            dispatch(addToast({ type: "success", message: `${item.name} removed from cart` }));
          }}
          className="ml-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
        >
          Remove
        </button>
      </div>
    </article>
  );
};

export default CartItem;
