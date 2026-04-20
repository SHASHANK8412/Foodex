import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyRestaurants } from "../redux/slices/restaurantSlice";
import { fetchOrders } from "../redux/slices/orderSlice";

const RestaurantPartnerDashboardPage = () => {
  const dispatch = useDispatch();
  const restaurantsState = useSelector((state) => state.restaurants);
  const ordersState = useSelector((state) => state.orders);

  useEffect(() => {
    dispatch(fetchMyRestaurants());
    dispatch(fetchOrders());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Restaurant dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Manage your restaurants and view incoming orders.</p>
      </header>

      {(restaurantsState.error || ordersState.error) && (
        <p className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {restaurantsState.error || ordersState.error}
        </p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your restaurants</h2>
        {restaurantsState.loading ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Loading…</p>
        ) : restaurantsState.myRestaurants.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No restaurants linked to this account yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {restaurantsState.myRestaurants.map((restaurant) => (
              <article key={restaurant._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{restaurant.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{restaurant.address?.city || "—"}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent orders</h2>
        {ordersState.loading ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Loading…</p>
        ) : ordersState.orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No orders yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {ordersState.orders.map((order) => (
              <article key={order._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Order {order._id.slice(-8)}</p>
                  <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase dark:bg-slate-800">{order.status}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Total: ₹{Number(order.totalAmount || 0).toFixed(2)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default RestaurantPartnerDashboardPage;
