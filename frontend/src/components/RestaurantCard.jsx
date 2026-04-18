import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toggleFavoriteRestaurant } from "../redux/slices/wishlistSlice";
import { addToast } from "../redux/slices/uiSlice";

const RestaurantCard = ({ restaurant }) => {
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.wishlist.restaurantIds);
  const isFavorite = favorites.includes(restaurant._id);

  const rating = restaurant.rating ?? 4.2;
  const deliveryTime = restaurant.deliveryTime ?? "25-35 min";
  const tags = restaurant.cuisine?.slice(0, 3) || ["Popular", "Fast", "Fresh"];
  const demandLevel = restaurant.demandLevel || "low";
  const estimatedWaitMinutes = restaurant.estimatedWaitMinutes || 20;
  const imageUrl =
    restaurant.imageUrl ||
    restaurant.image ||
    `https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80`;

  const toggleFavorite = () => {
    dispatch(toggleFavoriteRestaurant(restaurant._id));
    dispatch(
      addToast({
        type: "success",
        message: isFavorite ? "Removed from wishlist" : "Added to wishlist",
      })
    );
  };

  return (
    <article className="group overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-44 overflow-hidden">
        <img src={imageUrl} alt={restaurant.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <button
          type="button"
          onClick={toggleFavorite}
          className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-slate-700 shadow dark:bg-slate-900/90 dark:text-slate-100"
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{restaurant.name}</h3>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {restaurant.isOpen !== false ? "Open" : "Closed"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">⭐ {rating}</span>
          <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">{deliveryTime}</span>
          <span
            className={
              "rounded-full px-2 py-1 " +
              (demandLevel === "high"
                ? "bg-rose-100 text-rose-700"
                : demandLevel === "medium"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700")
            }
          >
            {demandLevel === "high" ? "High Demand" : demandLevel === "medium" ? "Busy" : "Normal"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {restaurant.address?.city || "Unknown city"}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Estimated wait: {estimatedWaitMinutes} mins</p>
        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{restaurant.description || "Fresh meals and comfort food."}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-orange-200 px-2 py-1 text-[11px] font-semibold text-orange-700 dark:border-slate-700 dark:text-orange-300">
              {tag}
            </span>
          ))}
        </div>
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
