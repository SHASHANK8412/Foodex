import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import RestaurantCard from "../components/RestaurantCard";
import { fetchRestaurants } from "../redux/slices/restaurantSlice";

const RestaurantsPage = () => {
  const dispatch = useDispatch();
  const { restaurants, loading, error } = useSelector((state) => state.restaurants);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dispatch(fetchRestaurants());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return restaurants;
    }

    return restaurants.filter((item) => {
      const inName = item.name?.toLowerCase().includes(value);
      const inCuisine = item.cuisine?.join(" ").toLowerCase().includes(value);
      const inCity = item.address?.city?.toLowerCase().includes(value);
      return inName || inCuisine || inCity;
    });
  }, [restaurants, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Restaurants</h1>
          <p className="text-sm text-slate-600">Pick from popular kitchens near you.</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, cuisine, city"
          className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none ring-orange-400 transition focus:ring sm:w-80"
        />
      </div>

      {loading && <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">Loading restaurants...</p>}
      {error && <p className="rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!loading && filtered.map((restaurant) => <RestaurantCard key={restaurant._id} restaurant={restaurant} />)}
      </div>
    </div>
  );
};

export default RestaurantsPage;
