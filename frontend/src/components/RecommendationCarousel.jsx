import { Link } from "react-router-dom";

const RecommendationCarousel = ({ title, items = [] }) => {
  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <Link
            key={item._id}
            to={`/restaurants/${item.restaurant?._id || item.restaurant}`}
            className="min-w-[220px] rounded-2xl border border-slate-200 p-3 transition hover:-translate-y-0.5 dark:border-slate-700"
          >
            <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.restaurant?.name || "Kitchen"}</p>
            <p className="mt-2 text-sm font-bold text-rose-600">Rs.{item.price}</p>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RecommendationCarousel;
