import { Link } from "react-router-dom";

const RestaurantCard = ({ restaurant }) => {
  return (
    <article className="group overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="h-44 bg-gradient-to-br from-orange-300 via-amber-200 to-rose-300" />
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{restaurant.name}</h3>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {restaurant.isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-slate-600">{restaurant.description || "Fresh meals and comfort food."}</p>
        <p className="text-xs uppercase tracking-wide text-slate-400">{restaurant.address?.city || "Unknown city"}</p>
        <Link
          to={"/restaurants/" + restaurant._id}
          className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
        >
          View menu
        </Link>
      </div>
    </article>
  );
};

export default RestaurantCard;
