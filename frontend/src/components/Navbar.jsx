import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import { setSearchQuery } from "../redux/slices/uiSlice";
import DarkModeToggle from "./DarkModeToggle";

const navClass = ({ isActive }) =>
  "rounded-full px-3 py-2 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 dark:focus-visible:ring-orange-500/30 " +
  (isActive
    ? "bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-sm"
    : "text-slate-700 hover:bg-orange-50/80 hover:text-orange-900 dark:text-slate-200 dark:hover:bg-slate-900/60 dark:hover:text-orange-200");

const roleLabel = {
  admin: "Admin",
  delivery: "Delivery",
  restaurant: "Restaurant",
  user: "User",
};

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const itemCount = useSelector((state) => state.cart.items.length);
  const searchQuery = useSelector((state) => state.ui.searchQuery);

  const isDeliveryArea = location.pathname.startsWith("/delivery");
  const isRestaurantArea = location.pathname.startsWith("/restaurant");

  const isDeliveryUser = user?.role === "delivery";
  const isRestaurantUser = user?.role === "restaurant";

  const homeHref = isDeliveryUser
    ? "/delivery"
    : isRestaurantUser
      ? "/restaurant"
      : isDeliveryArea
        ? "/delivery/login"
        : isRestaurantArea
          ? "/restaurant/login"
          : "/";

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/70 bg-white/70 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/65">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to={homeHref} className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 font-black text-white shadow-lg">
            F
          </span>
          <div>
            <p className="text-lg font-black leading-none tracking-tight text-slate-900 dark:text-slate-100">Foodex</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Warm delivery, premium feel</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {isDeliveryUser ? (
            <>
              <NavLink to="/delivery" className={navClass}>
                Delivery
              </NavLink>
              <NavLink to="/orders/track" className={navClass}>
                Tracking
              </NavLink>
            </>
          ) : isRestaurantUser ? (
            <NavLink to="/restaurant" className={navClass}>
              Restaurant
            </NavLink>
          ) : (
            <>
              <NavLink to="/" className={navClass} end>
                Home
              </NavLink>
              <NavLink to="/restaurants" className={navClass}>
                Restaurants
              </NavLink>
              <NavLink to="/orders/track" className={navClass}>
                Tracking
              </NavLink>
              {user?.role === "restaurant" && (
                <NavLink to="/restaurant" className={navClass}>
                  Restaurant
                </NavLink>
              )}
              {user?.role === "delivery" && (
                <NavLink to="/delivery" className={navClass}>
                  Delivery
                </NavLink>
              )}
              {user?.role === "admin" && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {!isDeliveryUser && !isRestaurantUser && (
            <input
              value={searchQuery}
              onChange={(event) => dispatch(setSearchQuery(event.target.value))}
              placeholder="Search restaurants, dishes, cuisines"
              className="w-72 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm text-slate-700 outline-none ring-orange-400/40 backdrop-blur focus:ring-2 dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
          {!isDeliveryUser && !isRestaurantUser && (
            <Link
              to="/cart"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Cart ({itemCount})
            </Link>
          )}
          {!user ? (
            <>
              {isDeliveryArea ? (
                <>
                  <Link
                    to="/delivery/login"
                    className="rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:border-slate-600"
                  >
                    Delivery login
                  </Link>
                  <Link
                    to="/delivery/register"
                    className="rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    Delivery register
                  </Link>
                </>
              ) : isRestaurantArea ? (
                <>
                  <Link
                    to="/restaurant/login"
                    className="rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:border-slate-600"
                  >
                    Restaurant login
                  </Link>
                  <Link
                    to="/restaurant/register"
                    className="rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    Restaurant register
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:border-slate-600"
                  >
                    User login
                  </Link>
                  <Link
                    to="/restaurant/login"
                    className="hidden rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:border-slate-600 lg:inline-flex"
                  >
                    Restaurant login
                  </Link>
                  <Link
                    to="/delivery/login"
                    className="hidden rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:border-slate-600 lg:inline-flex"
                  >
                    Delivery login
                  </Link>
                  <Link to="/register" className="hidden rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift sm:inline-flex">
                    Register
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex dark:border-slate-700 dark:bg-slate-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-xs font-bold uppercase text-white">
                  {user?.name?.charAt(0) || "U"}
                </span>
                <div className="min-w-0">
                  <p className="max-w-28 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name || "Profile"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{roleLabel[user?.role] || "User"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-slate-200/80 bg-white/60 px-4 py-2 text-sm font-extrabold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-700/80 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:border-slate-600"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
