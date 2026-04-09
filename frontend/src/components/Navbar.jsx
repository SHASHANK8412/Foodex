import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import { setSearchQuery } from "../redux/slices/uiSlice";
import DarkModeToggle from "./DarkModeToggle";

const navClass = ({ isActive }) =>
  "rounded-full px-3 py-2 text-sm font-medium transition " +
  (isActive ? "bg-rose-500 text-white" : "text-slate-700 hover:bg-rose-100 hover:text-rose-700");

const roleLabel = {
  admin: "Admin",
  delivery: "Delivery",
  user: "User",
};

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const itemCount = useSelector((state) => state.cart.items.length);
  const searchQuery = useSelector((state) => state.ui.searchQuery);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
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

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={navClass} end>
            Home
          </NavLink>
          <NavLink to="/restaurants" className={navClass}>
            Restaurants
          </NavLink>
          <NavLink to="/orders/track" className={navClass}>
            Tracking
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center lg:flex">
          <input
            value={searchQuery}
            onChange={(event) => dispatch(setSearchQuery(event.target.value))}
            placeholder="Search restaurants or cuisine"
            className="w-64 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none ring-orange-400 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <Link to="/cart" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Cart ({itemCount})
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
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-200"
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
