import { useDispatch } from "react-redux";
import { addToCart } from "../redux/slices/cartSlice";
import { formatCurrency } from "../utils/format";
import { addToast } from "../redux/slices/uiSlice";

const MenuItemCard = ({ item, restaurantId }) => {
  const dispatch = useDispatch();

  const handleAdd = () => {
    dispatch(
      addToCart({
        menuItemId: item._id,
        restaurantId,
        name: item.name,
        price: item.price,
      })
    );
    dispatch(addToast({ type: "success", message: `${item.name} added to cart` }));
  };

  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{item.name}</h4>
          <span className={"h-2 w-2 rounded-full " + (item.isVeg ? "bg-emerald-500" : "bg-rose-500")} />
          {item.recommended && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Recommended</span>}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{item.description || "Chef special recommendation."}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.price)}</p>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 dark:border-slate-600 dark:bg-slate-800 dark:text-orange-300"
      >
        Add
      </button>
    </article>
  );
};

export default MenuItemCard;
