import { Link } from "react-router-dom";
import { useState } from "react";

const PartnerTopbar = ({ selectedRestaurant, restaurants, notificationsCount, onRestaurantChange, user }) => {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Partner Panel</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Restaurant Dashboard</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRestaurant}
            onChange={(event) => onRestaurantChange(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant._id} value={restaurant._id}>
                {restaurant.name}
              </option>
            ))}
          </select>

          <Link
            to="/restaurant-dashboard"
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Ops View
          </Link>

          <div className="rounded-full bg-orange-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
            Alerts {notificationsCount}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-xs font-bold uppercase text-white">
                {user?.name?.charAt(0) || "P"}
              </span>
              {user?.name?.split(" ")[0] || "Partner"}
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <Link
                  to="/restaurant-dashboard"
                  onClick={() => setProfileOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/analytics"
                  onClick={() => setProfileOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Analytics
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default PartnerTopbar;
