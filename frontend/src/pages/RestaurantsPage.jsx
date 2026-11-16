import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import RestaurantCard from "../components/RestaurantCard";
import RestaurantCardSkeleton from "../components/RestaurantCardSkeleton";
import { connectSocket, getSocket } from "../services/socket";
import { fetchRestaurants } from "../redux/slices/restaurantSlice";

const RestaurantsPage = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const globalQuery = useSelector((state) => state.ui.searchQuery);
  const { restaurants: restaurantState, loading, error } = useSelector((state) => state.restaurants);
  // Live demand from Socket.io, layered over the restaurants from the store.
  const [demandById, setDemandById] = useState({});
  const restaurantList = useMemo(
    () => (restaurantState || []).map((restaurant) => ({ ...restaurant, ...(demandById[restaurant._id] || {}) })),
    [restaurantState, demandById]
  );
  const restaurantIds = useMemo(() => (restaurantState || []).map((restaurant) => restaurant._id).join(","), [restaurantState]);

  // The search box follows the navbar search; typing here edits it locally.
  const [query, setQuery] = useState(globalQuery || "");
  const [syncedQuery, setSyncedQuery] = useState(globalQuery);
  if (globalQuery !== syncedQuery) {
    setSyncedQuery(globalQuery);
    setQuery(globalQuery || "");
  }
  const [ratingFilter, setRatingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");

  useEffect(() => {
    dispatch(fetchRestaurants());
  }, [dispatch]);

  // Subscribes once per set of restaurants. Demand updates change only
  // demandById, so they no longer tear down and rebuild the subscriptions.
  useEffect(() => {
    if (!token || !restaurantIds) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    const ids = restaurantIds.split(",");
    ids.forEach((restaurantId) => socket.emit("restaurant:subscribe", { restaurantId }));

    const onDemandUpdate = (payload) => {
      if (!payload?.restaurantId) return;
      setDemandById((previous) => ({
        ...previous,
        [payload.restaurantId]: {
          demandLevel: payload.demandLevel,
          activeOrders: payload.activeOrders,
          estimatedWaitMinutes: payload.estimatedWaitMinutes,
          ...(payload.deliveryMinutes ? { deliveryMinutes: payload.deliveryMinutes } : {}),
        },
      }));
    };

    socket.on("demand:update", onDemandUpdate);

    return () => {
      const activeSocket = getSocket();
      ids.forEach((restaurantId) => activeSocket?.emit("restaurant:unsubscribe", { restaurantId }));
      activeSocket?.off("demand:update", onDemandUpdate);
    };
  }, [token, restaurantIds]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const filteredItems = restaurantList.filter((item) => {
      const inName = item.name?.toLowerCase().includes(value);
      const inCuisine = item.cuisine?.join(" ").toLowerCase().includes(value);
      const inCity = item.address?.city?.toLowerCase().includes(value);
      // Dishes too: "pizza" finds Pasta Street, whose cuisine is Italian.
      const inDishes = [...(item.dishNames || []), ...(item.dishTags || [])].some((dish) => dish.toLowerCase().includes(value));
      const matchesQuery = !value || inName || inCuisine || inCity || inDishes;
      const rating = item.rating ?? 4;
      const matchesRating = ratingFilter === "all" || rating >= Number(ratingFilter);
      const matchesCategory = categoryFilter === "all" || item.cuisine?.includes(categoryFilter);
      return matchesQuery && matchesRating && matchesCategory;
    });

    // Open restaurants always come before closed ones.
    const openFirst = (compare) => (a, b) => (a.isOpen === false) - (b.isOpen === false) || compare(a, b);

    if (sortBy === "top_rated") {
      return [...filteredItems].sort(openFirst((a, b) => (b.rating ?? 0) - (a.rating ?? 0)));
    }

    if (sortBy === "fast_delivery") {
      return [...filteredItems].sort(openFirst((a, b) => (a.deliveryMinutes ?? 99) - (b.deliveryMinutes ?? 99)));
    }

    // Recommended: open first, then rating.
    return [...filteredItems].sort(openFirst((a, b) => (b.rating ?? 0) - (a.rating ?? 0)));
  }, [restaurantList, query, ratingFilter, categoryFilter, sortBy]);

  const cuisineOptions = useMemo(() => {
    const set = new Set();
    restaurantList.forEach((item) => item.cuisine?.forEach((cuisine) => set.add(cuisine)));
    return ["all", ...Array.from(set)];
  }, [restaurantList]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Restaurants</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Pick from popular kitchens near you.</p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search restaurants, cuisines or dishes"
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none ring-orange-400 transition focus:ring dark:border-slate-700 dark:bg-slate-900"
          />
          <select
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">All ratings</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {cuisineOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All categories" : option}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="recommended">Recommended</option>
            <option value="fast_delivery">Fast delivery</option>
            <option value="top_rated">Top rated</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => dispatch(fetchRestaurants())}
            disabled={loading}
            className="rounded-full bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, index) => <RestaurantCardSkeleton key={index} />)}
        {!loading &&
          filtered.map((restaurant) => (
            <RestaurantCard
              key={restaurant._id}
              restaurant={restaurant}
              matchedDishes={
                query.trim()
                  ? (restaurant.dishNames || []).filter((dish) => dish.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 3)
                  : []
              }
            />
          ))}
        {!loading && !error && restaurantList.length > 0 && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {query.trim() ? `No restaurants or dishes match "${query.trim()}".` : "No restaurants match these filters."}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setRatingFilter("all");
                setCategoryFilter("all");
              }}
              className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Clear search and filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantsPage;
