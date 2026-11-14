import { useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toggleFavoriteRestaurant } from "../redux/slices/wishlistSlice";
import { addToast } from "../redux/slices/uiSlice";

const RestaurantCard = ({ restaurant, matchedDishes = [] }) => {
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.wishlist.restaurantIds);
  const isFavorite = favorites.includes(restaurant._id);

  const rating = restaurant.rating ?? 4.2;
  // The API's estimate (kitchen wait plus travel), the same one checkout shows.
  const deliveryMinutes = restaurant.deliveryMinutes ?? (Number(restaurant.estimatedWaitMinutes) || 20) + 15;
  const isOpen = restaurant.isOpen !== false;
  const [imageFailed, setImageFailed] = useState(false);
  const tags = restaurant.cuisine?.slice(0, 3) || ["Popular", "Fast", "Fresh"];
  const demandLevel = restaurant.demandLevel || "low";
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
    <article
      className={`group overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 ${
        isOpen ? "" : "opacity-75"
      }`}
    >
      <div className="relative h-44 overflow-hidden">
        {imageFailed ? (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-200 via-rose-200 to-amber-100 text-5xl font-black text-rose-700/70 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 dark:text-slate-300"
          >
            {restaurant.name?.charAt(0) || "F"}
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={restaurant.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${isOpen ? "" : "grayscale"}`}
          />
        )}
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
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isOpen ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            {isOpen ? "Open" : "Closed now"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">⭐ {rating}</span>
          {isOpen && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">About {deliveryMinutes} min</span>}
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
        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{restaurant.description || "Fresh meals and comfort food."}</p>
        {matchedDishes.length > 0 && (
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Serves {matchedDishes.join(", ")}</p>
        )}
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
