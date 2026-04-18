import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import api from "../services/api";

const RestaurantDashboardPage = () => {
  const [data, setData] = useState({ restaurants: [], kpis: {}, topDishes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/owner/dashboard");
      setData(response.data.data);
      if (!selectedRestaurant && response.data.data.restaurants?.[0]?._id) {
        setSelectedRestaurant(response.data.data.restaurants[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleFeatured = async (itemId, enabled) => {
    if (!selectedRestaurant) return;
    await api.put(`/owner/restaurants/${selectedRestaurant}/featured-items`, {
      itemIds: enabled ? [itemId] : [],
    });
  };

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p className="text-rose-600">{error}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black">Restaurant Owner Dashboard</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow">
          <p className="text-sm text-slate-500">Orders Today</p>
          <p className="text-2xl font-black">{data.kpis?.ordersToday || 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow">
          <p className="text-sm text-slate-500">Pending Orders</p>
          <p className="text-2xl font-black">{data.kpis?.pendingOrders || 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow">
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="text-2xl font-black">Rs {Math.round(data.kpis?.revenue || 0)}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="font-bold mb-3">Restaurants</h2>
        <select
          className="rounded-xl border px-3 py-2"
          value={selectedRestaurant}
          onChange={(e) => setSelectedRestaurant(e.target.value)}
        >
          {data.restaurants?.map((restaurant) => (
            <option key={restaurant._id} value={restaurant._id}>{restaurant.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="font-bold mb-3">Top Dishes</h2>
        <div className="space-y-2">
          {data.topDishes?.map((dish) => (
            <div key={dish._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{dish._id}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{dish.qty}</span>
                <button onClick={() => toggleFeatured(dish._id, true)} className="text-xs bg-orange-500 text-white rounded-full px-3 py-1">Feature</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDashboardPage;
