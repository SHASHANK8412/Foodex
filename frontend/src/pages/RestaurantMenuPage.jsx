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
    return <p className="rounded-2xl bg-white p-6">Loading menu...</p>;
  }

  if (error) {
    return <p className="rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</p>;
  }

  if (!selectedRestaurant?.restaurant) {
    return <p className="rounded-2xl bg-white p-6 text-sm">Restaurant not found.</p>;
  }

  const { restaurant, menu } = selectedRestaurant;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Menu</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{restaurant.name}</h1>
        <p className="mt-2 text-sm text-slate-600">{restaurant.description || "Freshly prepared delights from this kitchen."}</p>
        {demandForecast?.peakHour !== undefined && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            Predicted peak demand: {String(demandForecast.peakHour).padStart(2, "0")}:00
          </div>
        )}
      </header>

      <div className="space-y-3">
        {menu?.length ? (
          menu.map((item) => <MenuItemCard key={item._id} item={item} restaurantId={restaurantId} />)
        ) : (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">No menu items available right now.</p>
        )}
      </div>

      <Link to="/cart" className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600">
        Go to cart
      </Link>
    </div>
  );
};

export default RestaurantMenuPage;
