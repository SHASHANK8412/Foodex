import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import LandingSection from "./LandingSection";
import Reveal from "../Reveal";
import { toggleFavoriteRestaurant } from "../../redux/slices/wishlistSlice";
import { addToast } from "../../redux/slices/uiSlice";

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "FX";

const PremiumRestaurantCard = ({ restaurant }) => {
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.wishlist.restaurantIds);
  const isFavorite = favorites.includes(restaurant._id);

  const rating = restaurant.rating ?? 4.4;
  const deliveryTime = restaurant.deliveryTime ?? "20-30 min";
  const tags = restaurant.cuisine?.slice(0, 3) || ["Top rated", "Fast", "Fresh"];

  const imageUrl = restaurant.image || "";

  const toggle = () => {
    dispatch(toggleFavoriteRestaurant(restaurant._id));
    dispatch(addToast({ type: "success", message: isFavorite ? "Removed from wishlist" : "Added to wishlist" }));
  };

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-orange-100/70 bg-white/70 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lift dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className="relative h-44 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={restaurant.name}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(250,204,21,0.22),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(244,63,94,0.22),transparent_58%),radial-gradient(circle_at_55%_90%,rgba(249,115,22,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.8),rgba(255,255,255,0.55))] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(250,204,21,0.10),transparent_55%),radial-gradient(circle_at_85%_30%,rgba(244,63,94,0.14),transparent_58%),radial-gradient(circle_at_55%_90%,rgba(249,115,22,0.10),transparent_60%),linear-gradient(180deg,rgba(2,6,23,0.35),rgba(2,6,23,0.20))]" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent" />

        <button
          type="button"
          onClick={toggle}
          className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/80 px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-50"
          aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
        >
          <span className="text-sm leading-none">{isFavorite ? "♥" : "♡"}</span>
          <span className="hidden sm:inline">Save</span>
        </button>

        {!imageUrl && (
          <div className="absolute left-4 bottom-4 inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-sm font-black text-slate-900 shadow-sm backdrop-blur dark:bg-slate-950/55 dark:text-slate-50">
              {initials(restaurant.name)}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold text-white drop-shadow">{restaurant.address?.city || "Nearby"}</p>
              <p className="text-xs text-white/80">Handpicked picks</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black text-slate-900 dark:text-slate-50">{restaurant.name}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {restaurant.address?.city || "Your city"} • {restaurant.isOpen ? "Open now" : "Closed"}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            ★ {rating}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-extrabold">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{deliveryTime}</span>
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-orange-200/70 bg-orange-50/60 px-3 py-1 text-orange-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-orange-200"
            >
              {tag}
            </span>
          ))}
        </div>

        <Link to={"/restaurants/" + restaurant._id} className="btn-ghost w-full justify-center">
          View menu
        </Link>
      </div>
    </article>
  );
};

const PopularRestaurantsShowcase = () => {
  const { restaurants, loading } = useSelector((state) => state.restaurants);

  const curated = useMemo(() => {
    if (!restaurants?.length) return [];
    return [...restaurants]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6);
  }, [restaurants]);

  return (
    <LandingSection
      id="restaurants"
      kicker="Popular"
      title="Restaurants people can’t stop ordering from"
      subtitle="High-rated kitchens with menus that feel like they were made for your mood."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 6 }).map((_, idx) => (
            <Reveal key={idx} delayMs={idx * 40}>
              <div className="h-[340px] animate-pulse rounded-[1.75rem] border border-orange-100/70 bg-white/60 dark:border-slate-800/70 dark:bg-slate-950/35" />
            </Reveal>
          ))}

        {!loading &&
          curated.map((restaurant, idx) => (
            <Reveal key={restaurant._id} delayMs={60 + idx * 60}>
              <PremiumRestaurantCard restaurant={restaurant} />
            </Reveal>
          ))}
      </div>

      <Reveal delayMs={80}>
        <div className="flex justify-center">
          <Link to="/restaurants" className="btn-primary">
            Explore all restaurants
          </Link>
        </div>
      </Reveal>
    </LandingSection>
  );
};

export default PopularRestaurantsShowcase;
