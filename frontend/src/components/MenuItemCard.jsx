import { useDispatch } from "react-redux";
import { addToCart } from "../redux/slices/cartSlice";
import { formatCurrency } from "../utils/format";

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
  };

  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-300 hover:shadow-md">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-900">{item.name}</h4>
          <span className={"h-2 w-2 rounded-full " + (item.isVeg ? "bg-emerald-500" : "bg-rose-500")} />
        </div>
        <p className="text-sm text-slate-500">{item.description || "Chef special recommendation."}</p>
        <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.price)}</p>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
      >
        Add
      </button>
    </article>
  );
};

export default MenuItemCard;
