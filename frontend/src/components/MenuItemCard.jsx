import { useDispatch, useSelector } from "react-redux";
import { Flame, Minus, Plus } from "lucide-react";
import { addToCart, removeFromCart, updateQuantity } from "../redux/slices/cartSlice";
import { formatCurrency } from "../utils/format";
import { addToast } from "../redux/slices/uiSlice";

// The Indian food-labelling mark: a green square for vegetarian, brown for non-vegetarian.
export const DietMark = ({ isVeg }) => (
  <span
    role="img"
    aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
    title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${isVeg ? "border-emerald-600" : "border-amber-800"}`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-amber-800"}`} />
  </span>
);

const MenuItemCard = ({ item, restaurantId, restaurantName, disabled = false }) => {
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);
  const inCart = cartItems.find((line) => line.menuItemId === item._id);
  const otherRestaurant = cartItems.length > 0 && cartItems[0].restaurantId !== restaurantId;

  const handleAdd = () => {
    // A cart holds one restaurant's dishes; switching restaurants replaces it, so ask first.
    if (otherRestaurant && !window.confirm(`Your cart has dishes from another restaurant. Start a new cart from ${restaurantName || "this restaurant"}?`)) {
      return;
    }
    dispatch(addToCart({ menuItemId: item._id, restaurantId, name: item.name, price: item.price }));
    dispatch(addToast({ type: "success", message: `${item.name} added to cart` }));
  };

  const changeQuantity = (delta) => {
    const next = inCart.quantity + delta;
    if (next < 1) {
      dispatch(removeFromCart(item._id));
    } else {
      dispatch(updateQuantity({ menuItemId: item._id, quantity: next }));
    }
  };

  return (
    <article className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <DietMark isVeg={item.isVeg} />
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{item.name}</h4>
          {item.spiceLevel === "hot" && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400" title="Spicy">
              <Flame size={13} aria-hidden="true" /> Spicy
            </span>
          )}
          {item.recommended && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Popular</span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{item.description || "Chef special recommendation."}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(item.price)}</p>
      </div>

      {inCart ? (
        <div className="inline-flex shrink-0 items-center rounded-full border border-rose-300 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10">
          <button
            type="button"
            onClick={() => changeQuantity(-1)}
            aria-label={`Remove one ${item.name}`}
            className="rounded-l-full px-3 py-2 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="min-w-6 text-center text-sm font-bold tabular-nums text-rose-800 dark:text-rose-200" aria-live="polite">
            {inCart.quantity}
          </span>
          <button
            type="button"
            onClick={() => changeQuantity(1)}
            aria-label={`Add one more ${item.name}`}
            className="rounded-r-full px-3 py-2 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="shrink-0 rounded-full border border-orange-300 bg-orange-50 px-5 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-orange-300"
        >
          Add
        </button>
      )}
    </article>
  );
};

export default MenuItemCard;
