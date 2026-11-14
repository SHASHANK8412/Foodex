import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { Home, Package, Sparkles, Store, User } from "lucide-react";

// Bottom tab bar for phones, where the top navigation does not fit.
const MobileTabBar = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  const accountTarget = !user
    ? "/login"
    : role === "delivery"
      ? "/delivery"
      : role === "owner"
        ? "/restaurant-dashboard"
        : role === "admin"
          ? "/admin"
          : "/user-dashboard";

  const tabs = [
    { to: "/", label: "Home", Icon: Home, end: true },
    { to: "/restaurants", label: "Restaurants", Icon: Store },
    ...(!user || ["user", "admin"].includes(role) ? [{ to: "/ai-order", label: "Order with AI", short: "AI order", Icon: Sparkles }] : []),
    { to: "/orders/track", label: "Orders", Icon: Package },
    { to: accountTarget, label: user ? "Account" : "Sign in", Icon: User },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.Icon;
          return (
            <li key={tab.label} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-semibold ${
                    isActive ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
                  }`
                }
              >
                <Icon size={20} aria-hidden="true" />
                <span>{tab.short || tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileTabBar;
