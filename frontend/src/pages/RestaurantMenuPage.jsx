import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchRestaurantById } from "../redux/slices/restaurantSlice";
import { fetchDemandForecast } from "../redux/slices/analyticsSlice";
import MenuItemCard from "../components/MenuItemCard";

const RestaurantMenuPage = () => {
  const { restaurantId } = useParams();
  const dispatch = useDispatch();
  const { selectedRestaurant, loading, error } = useSelector((state) => state.restaurants);
  const { demandForecast } = useSelector((state) => state.analytics);

  useEffect(() => {
    dispatch(fetchRestaurantById(restaurantId));
    dispatch(fetchDemandForecast(restaurantId));
  }, [dispatch, restaurantId]);

  if (loading) {
    return <p className="rounded-2xl bg-white p-6 dark:bg-slate-900">Loading menu...</p>;
  }

  if (error) {
    return <p className="rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</p>;
  }

  if (!selectedRestaurant?.restaurant) {
    return <p className="rounded-2xl bg-white p-6 text-sm dark:bg-slate-900">Restaurant not found.</p>;
  }

  const { restaurant, menu } = selectedRestaurant;
  const categories = Array.from(new Set((menu || []).map((item) => item.category).filter(Boolean)));
  const recommended = (menu || []).filter((item) => item.recommended).slice(0, 3);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Menu</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{restaurant.name}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{restaurant.description || "Freshly prepared delights from this kitchen."}</p>
        {demandForecast?.peakHour !== undefined && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            Predicted peak demand: {String(demandForecast.peakHour).padStart(2, "0")}:00
          </div>
        )}
        {!!categories.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                {category}
              </span>
            ))}
          </div>
        )}
      </header>

      {!!recommended.length && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Recommended items</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Most-ordered dishes from this kitchen.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {recommended.map((item) => (
              <div key={item._id} className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{item.category || "Chef pick"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
        {menu?.length ? (
          menu.map((item) => <MenuItemCard key={item._id} item={item} restaurantId={restaurantId} />)
        ) : (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">No menu items available right now.</p>
        )}
      </div>

      <Link to="/cart" className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600">
        Go to cart
      </Link>
    </div>
  );
};

export default RestaurantMenuPage;
