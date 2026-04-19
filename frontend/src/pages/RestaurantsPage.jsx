import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import RestaurantCard from "../components/RestaurantCard";
import { fetchRestaurants } from "../redux/slices/restaurantSlice";
import RestaurantCardSkeleton from "../components/RestaurantCardSkeleton";
import { setLocation, setSearchQuery } from "../redux/slices/uiSlice";

const RestaurantsPage = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { restaurants, loading, error } = useSelector((state) => state.restaurants);
  const globalQuery = useSelector((state) => state.ui.searchQuery);
  const globalLocation = useSelector((state) => state.ui.location);
  const query = globalQuery || "";
  const location = globalLocation || "";

  const [ratingFilter, setRatingFilter] = useState(searchParams.get("rating") || "all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("cuisine") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "recommended");

  useEffect(() => {
    dispatch(fetchRestaurants());
  }, [dispatch]);

  useEffect(() => {
    const hasQ = searchParams.has("q");
    const hasLoc = searchParams.has("loc");
    const q = searchParams.get("q") || "";
    const loc = searchParams.get("loc") || "";
    const rating = searchParams.get("rating") || "all";
    const cuisine = searchParams.get("cuisine") || "all";
    const sort = searchParams.get("sort") || "recommended";

    if (hasQ && q !== query) dispatch(setSearchQuery(q));
    if (hasLoc && loc !== location) dispatch(setLocation(loc));

    setRatingFilter(rating);
    setCategoryFilter(cuisine);
    setSortBy(sort);
    // Intentionally omit query/location from deps to avoid loops; URL is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, searchParams]);

  const updateUrlParams = (next) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next || {}).forEach(([key, value]) => {
      const v = value === undefined || value === null ? "" : String(value);

      if (!v || v === "all" || (key === "sort" && v === "recommended")) {
        params.delete(key);
        return;
      }

      params.set(key, v);
    });

    setSearchParams(params, { replace: true });
  };

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const locationValue = location.trim().toLowerCase();
    const filteredItems = restaurants.filter((item) => {
      const nameText = String(item.name || "").toLowerCase();
      const cuisineText = (Array.isArray(item.cuisine) ? item.cuisine.join(" ") : String(item.cuisine || "")).toLowerCase();
      const cityText = String(item.address?.city || "").toLowerCase();
      const areaText = String(item.address?.area || "").toLowerCase();

      const matchesQuery = !value || nameText.includes(value) || cuisineText.includes(value) || cityText.includes(value) || areaText.includes(value);

      const matchesLocation = !locationValue || cityText.includes(locationValue) || areaText.includes(locationValue);

      const rating = item.rating ?? 4;
      const matchesRating = ratingFilter === "all" || rating >= Number(ratingFilter);
      const matchesCategory = categoryFilter === "all" || item.cuisine?.includes(categoryFilter);
      return matchesQuery && matchesLocation && matchesRating && matchesCategory;
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
  }, [restaurants, query, location, ratingFilter, categoryFilter, sortBy]);

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
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              dispatch(setSearchQuery(value));
              updateUrlParams({ q: value.trim() });
            }}
            placeholder="Search by name, cuisine, city"
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none ring-orange-400 transition focus:ring dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            value={location}
            onChange={(event) => {
              const value = event.target.value;
              dispatch(setLocation(value));
              updateUrlParams({ loc: value.trim() });
            }}
            placeholder="City / Area"
            className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none ring-orange-400 transition focus:ring dark:border-slate-700 dark:bg-slate-900"
            aria-label="Delivery location"
          />
          <select
            value={ratingFilter}
            onChange={(event) => {
              const value = event.target.value;
              setRatingFilter(value);
              updateUrlParams({ rating: value });
            }}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">All ratings</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => {
              const value = event.target.value;
              setCategoryFilter(value);
              updateUrlParams({ cuisine: value });
            }}
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
            onChange={(event) => {
              const value = event.target.value;
              setSortBy(value);
              updateUrlParams({ sort: value });
            }}
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
