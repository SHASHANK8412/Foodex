import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import RestaurantCard from "../components/RestaurantCard";
import { fetchRestaurants } from "../redux/slices/restaurantSlice";
import RestaurantCardSkeleton from "../components/RestaurantCardSkeleton";

const RestaurantsPage = () => {
  const dispatch = useDispatch();
  const { restaurants, loading, error } = useSelector((state) => state.restaurants);
  const globalQuery = useSelector((state) => state.ui.searchQuery);
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");

  useEffect(() => {
    dispatch(fetchRestaurants());
  }, [dispatch]);

  useEffect(() => {
    setQuery(globalQuery || "");
  }, [globalQuery]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const filteredItems = restaurants.filter((item) => {
      const inName = item.name?.toLowerCase().includes(value);
      const inCuisine = item.cuisine?.join(" ").toLowerCase().includes(value);
      const inCity = item.address?.city?.toLowerCase().includes(value);
      const matchesQuery = !value || inName || inCuisine || inCity;
      const rating = item.rating ?? 4;
      const matchesRating = ratingFilter === "all" || rating >= Number(ratingFilter);
      const matchesCategory = categoryFilter === "all" || item.cuisine?.includes(categoryFilter);
      return matchesQuery && matchesRating && matchesCategory;
    });

    if (sortBy === "top_rated") {
      return [...filteredItems].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    if (sortBy === "fast_delivery") {
      return [...filteredItems].sort((a, b) => {
        const aTime = Number(String(a.deliveryTime || "30").split("-")[0]);
        const bTime = Number(String(b.deliveryTime || "30").split("-")[0]);
        return aTime - bTime;
      });
    }

    return filteredItems;
  }, [restaurants, query, ratingFilter, categoryFilter, sortBy]);

  const cuisineOptions = useMemo(() => {
    const set = new Set();
    restaurants.forEach((item) => item.cuisine?.forEach((cuisine) => set.add(cuisine)));
    return ["all", ...Array.from(set)];
  }, [restaurants]);

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
