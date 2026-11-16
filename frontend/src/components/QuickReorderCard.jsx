import { useDispatch } from "react-redux";
import { addToCart } from "../redux/slices/cartSlice";

const QuickReorderCard = ({ items = [] }) => {
  const dispatch = useDispatch();

  if (!items.length) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Quick Reorder Prediction</h2>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-slate-900">
          AI Pick
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Top items you are likely to order now.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.slice(0, 3).map((item) => (
          <article key={item._id} className="rounded-2xl border border-emerald-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.restaurant?.name || "Kitchen"}</p>
            <button
              type="button"
              onClick={() =>
                dispatch(
                  addToCart({
                    menuItemId: item._id,
                    restaurantId: item.restaurant?._id || item.restaurant,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                  })
                )
              }
              className="mt-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white"
            >
              Reorder
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default QuickReorderCard;
