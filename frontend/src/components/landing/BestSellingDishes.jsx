import { useEffect, useMemo, useState } from "react";
import LandingSection from "./LandingSection";
import Reveal from "../Reveal";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../../services/api";
import { fetchRestaurants } from "../../redux/slices/restaurantSlice";

const ACCENTS = [
  "from-roast-500/25 via-cream-50 to-gold-200/25",
  "from-slate-200/55 via-cream-50 to-amber-100/45",
  "from-spice-300/25 via-cream-50 to-sky-100/55",
  "from-leaf-500/18 via-cream-50 to-emerald-100/55",
  "from-roast-400/22 via-cream-50 to-spice-100/40",
  "from-gold-200/35 via-cream-50 to-amber-100/55",
];

const formatPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return `₹${num}`;
};

const DishCard = ({ dish }) => {
  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-orange-100/70 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lift dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className={"pointer-events-none absolute inset-0 bg-gradient-to-br " + dish.accent} />
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
      <div className="relative space-y-3">
        <p className="text-lg font-black text-slate-900 dark:text-slate-50">{dish.name}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{dish.note}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50">{dish.price}</span>
          <Link
            to={"/restaurants/" + dish.restaurantId}
            className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-900/80 transition hover:text-rose-600 dark:text-slate-50/80"
            aria-label={`View ${dish.restaurantName} menu`}
          >
            View
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
};

const BestSellingDishes = () => {
  const dispatch = useDispatch();
  const { restaurants } = useSelector((state) => state.restaurants);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);

  const curatedRestaurants = useMemo(() => {
    if (!restaurants?.length) return [];
    return [...restaurants].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6);
  }, [restaurants]);

  useEffect(() => {
    if (!restaurants?.length) {
      dispatch(fetchRestaurants());
    }
  }, [dispatch, restaurants?.length]);

  useEffect(() => {
    let cancelled = false;

    const loadSignatureDishes = async () => {
      if (!curatedRestaurants.length) return;

      setLoading(true);

      try {
        const collected = [];

        for (const restaurant of curatedRestaurants) {
          if (collected.length >= 6) break;

          const response = await api.get("/restaurants/" + restaurant._id);
          const menu = response.data?.data?.menu || [];
          const available = (menu || []).filter((item) => item?.isAvailable !== false);
          if (!available.length) continue;

          const specials = available.filter((item) => item?.isTodaySpecial);
          const preferred = available.filter((item) => item?.recommended);
          const source = specials.length ? specials : preferred.length ? preferred : available;

          for (const item of source.slice(0, 2)) {
            if (collected.length >= 6) break;
            collected.push({
              id: item._id,
              restaurantId: restaurant._id,
              restaurantName: restaurant.name || "Restaurant",
              name: item.name || "Signature dish",
              note: item.isTodaySpecial ? "Today’s special" : item.description || item.category || `From ${restaurant.name || "your city"}`,
              price: formatPrice(item.price) || "",
              accent: ACCENTS[collected.length % ACCENTS.length],
            });
          }
        }

        if (!cancelled) setDishes(collected);
      } catch {
        if (!cancelled) setDishes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSignatureDishes();

    return () => {
      cancelled = true;
    };
  }, [curatedRestaurants]);

  return (
    <LandingSection
      id="dishes"
      kicker="Best-Selling"
      title="Signature dishes worth the obsession"
      subtitle="These are the kinds of dishes people screenshot, then order again."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 6 }).map((_, idx) => (
            <Reveal key={idx} delayMs={60 + idx * 50}>
              <div className="h-[208px] animate-pulse rounded-[1.75rem] border border-orange-100/70 bg-white/60 dark:border-slate-800/70 dark:bg-slate-950/35" />
            </Reveal>
          ))}

        {!loading &&
          dishes.map((dish, idx) => (
            <Reveal key={dish.id || dish.name} delayMs={60 + idx * 50}>
              <DishCard dish={dish} />
            </Reveal>
          ))}

        {!loading && !dishes.length && (
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No signature dishes available yet.</p>
        )}
      </div>
    </LandingSection>
  );
};

export default BestSellingDishes;
