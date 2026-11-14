import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import { setSearchQuery } from "../redux/slices/uiSlice";
import DarkModeToggle from "./DarkModeToggle";

const navClass = ({ isActive }) =>
  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition " +
  (isActive ? "bg-rose-500 text-white" : "text-slate-700 hover:bg-rose-100 hover:text-rose-700 dark:text-slate-200 dark:hover:bg-slate-800");

const roleLabel = {
  admin: "Admin",
  delivery: "Delivery",
  user: "User",
  owner: "Owner",
};

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(
    localStorage.getItem("foodex_selected_location") || "All Locations"
  );
  const { user } = useSelector((state) => state.auth);
  // Dishes in the cart, counting quantities (2 × dosa is 2).
  const itemCount = useSelector((state) => state.cart.items.reduce((sum, item) => sum + item.quantity, 0));
  const searchQuery = useSelector((state) => state.ui.searchQuery);
  const restaurants = useSelector((state) => state.restaurants.restaurants);

  const userCity = user?.address?.city;
  const locationOptions = useMemo(() => {
    const set = new Set(["All Locations"]);
    if (userCity) {
      set.add(userCity);
    }
    (restaurants || []).forEach((restaurant) => {
      if (restaurant.address?.city) {
        set.add(restaurant.address.city);
      }
    });
    return Array.from(set);
  }, [restaurants, userCity]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  const handleLocationChange = (value) => {
    setSelectedLocation(value);
    localStorage.setItem("foodex_selected_location", value);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 font-black text-white shadow-lg">
            F
          </span>
          <div>
            <p className="text-lg font-black leading-none tracking-tight text-slate-900 dark:text-slate-100">Foodex</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Delivering joy, fast</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <NavLink to="/" className={navClass} end>
            Home
          </NavLink>
          <NavLink to="/restaurants" className={navClass}>
            Restaurants
          </NavLink>
          <NavLink to="/orders/track" className={navClass}>
            Tracking
          </NavLink>
          {(!user || ["user", "admin"].includes(user.role)) && (
            <NavLink to="/ai-order" className={navClass}>
              AI Order
            </NavLink>
          )}
          {user && (
            <NavLink to="/user-dashboard" className={navClass}>
              Dashboard
            </NavLink>
          )}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center 2xl:flex">
          <input
            value={searchQuery}
            onChange={(event) => dispatch(setSearchQuery(event.target.value))}
            placeholder="Search restaurants or cuisine"
            className="w-64 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none ring-orange-400 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="hidden xl:block">
          <select
            value={selectedLocation}
            onChange={(event) => handleLocationChange(event.target.value)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <Link
            to="/cart"
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 sm:px-4"
          >
            <ShoppingBag size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Cart</span>
            <span className="tabular-nums">{itemCount}</span>
          </Link>
          {!user ? (
            <>
              <Link to="/login" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-200">
                Login
              </Link>
              <Link to="/register" className="hidden rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 sm:inline-flex">
                Register
              </Link>
            </>
          ) : (
            <>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  aria-label="Account menu"
                  aria-expanded={profileOpen}
                  className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1.5 sm:px-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-xs font-bold uppercase text-white">
                    {user?.name?.charAt(0) || "U"}
                  </span>
                  <div className="hidden min-w-0 text-left sm:block">
                    <p className="max-w-28 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name || "Profile"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{roleLabel[user?.role] || "User"}</p>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <Link
                      to="/user-dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      My Dashboard
                    </Link>
                    <Link
                      to="/orders/track"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Track Orders
                    </Link>
                    {[
                      ["admin", "/admin", "Admin dashboard"],
                      ["admin", "/admin/pipeline", "Data pipeline"],
                      ["owner", "/restaurant-dashboard", "My restaurant"],
                      ["delivery", "/delivery", "My deliveries"],
                    ]
                      .filter(([role]) => user?.role === role)
                      .map(([, to, label]) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setProfileOpen(false)}
                          className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {label}
                        </Link>
                      ))}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
