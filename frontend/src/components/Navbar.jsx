import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/slices/authSlice";

const navClass = ({ isActive }) =>
  "rounded-full px-3 py-2 text-sm font-medium transition " +
  (isActive ? "bg-rose-500 text-white" : "text-slate-700 hover:bg-rose-100 hover:text-rose-700");

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const itemCount = useSelector((state) => state.cart.items.length);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 font-black text-white shadow-lg">
            F
          </span>
          <div>
            <p className="text-lg font-black leading-none tracking-tight text-slate-900">Foodex</p>
            <p className="text-xs text-slate-500">Delivering joy, fast</p>
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

        <div className="flex items-center gap-2">
          <Link to="/cart" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Cart ({itemCount})
          </Link>
          {!user ? (
            <>
              <Link to="/login" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">
                Login
              </Link>
              <Link to="/register" className="hidden rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 sm:inline-flex">
                Register
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
