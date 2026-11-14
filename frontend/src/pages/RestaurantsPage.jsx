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
      const matchesQuery = !value || inName || inCuisine || inCity;
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
            placeholder="Search by name, cuisine, city"
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

      {error && <p className="rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, index) => <RestaurantCardSkeleton key={index} />)}
        {!loading && filtered.map((restaurant) => <RestaurantCard key={restaurant._id} restaurant={restaurant} />)}
      </div>
    </div>
  );
};

export default RestaurantsPage;
