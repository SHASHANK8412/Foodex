import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const Footer = () => {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  const isDeliveryArea = location.pathname.startsWith("/delivery");
  const isRestaurantArea = location.pathname.startsWith("/restaurant");

  const dashboardHref = user?.role === "delivery" ? "/delivery" : user?.role === "restaurant" ? "/restaurant" : "/";

  return (
    <footer className="mt-20 border-t border-orange-100/70 bg-white/55 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/35">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr,0.8fr,1.2fr]">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 font-black text-white shadow-premium">
                F
              </span>
              <div>
                <p className="text-lg font-black text-slate-900 dark:text-slate-50">Foodex</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Premium food delivery</p>
              </div>
            </Link>

            <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
              Warm meals, elegant discovery, and live tracking — built to feel delightful on every interaction.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="chip">Live tracking</span>
              <span className="chip">Secure checkout</span>
              <span className="chip">Fast delivery</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Explore</p>
            <div className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/restaurants">
                Restaurants
              </Link>
              <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/cart">
                Cart
              </Link>
              <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/orders/track">
                Track order
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Account</p>
            <div className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {user ? (
                <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to={dashboardHref}>
                  Dashboard
                </Link>
              ) : isDeliveryArea ? (
                <>
                  <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/delivery/login">
                    Delivery login
                  </Link>
                  <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/delivery/register">
                    Delivery register
                  </Link>
                </>
              ) : isRestaurantArea ? (
                <>
                  <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/restaurant/login">
                    Restaurant login
                  </Link>
                  <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/restaurant/register">
                    Restaurant register
                  </Link>
                </>
              ) : (
                <>
                  <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/login">
                    Login
                  </Link>
                  <Link className="transition hover:text-rose-600 dark:hover:text-rose-400" to="/register">
                    Register
                  </Link>
                </>
              )}
              <a className="transition hover:text-rose-600 dark:hover:text-rose-400" href="#">
                Support
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Get the app</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Faster reorders, live tracking, and curated picks — in your pocket.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="#"
                className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm font-extrabold text-slate-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-50"
                aria-label="Download on the App Store"
              >
                App Store
              </a>
              <a
                href="#"
                className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm font-extrabold text-slate-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-50"
                aria-label="Get it on Google Play"
              >
                Google Play
              </a>
            </div>

            <div className="pt-2">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Follow</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <a className="transition hover:text-rose-600 dark:hover:text-rose-400" href="#">
                  Instagram
                </a>
                <a className="transition hover:text-rose-600 dark:hover:text-rose-400" href="#">
                  X
                </a>
                <a className="transition hover:text-rose-600 dark:hover:text-rose-400" href="#">
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-orange-100/70 pt-6 text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Foodex. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#" className="font-semibold transition hover:text-rose-600 dark:hover:text-rose-400">
              Privacy
            </a>
            <a href="#" className="font-semibold transition hover:text-rose-600 dark:hover:text-rose-400">
              Terms
            </a>
            <a href="#" className="font-semibold transition hover:text-rose-600 dark:hover:text-rose-400">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
