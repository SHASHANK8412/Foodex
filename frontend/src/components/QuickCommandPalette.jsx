import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setSearchQuery } from "../redux/slices/uiSlice";

const QuickCommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isOpenShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isOpenShortcut) {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  const actions = useMemo(() => {
    const baseActions = [
      {
        id: "restaurants",
        label: "Open Restaurants",
        keywords: "restaurants browse explore",
        run: () => navigate("/restaurants"),
      },
      {
        id: "cart",
        label: "Open Cart",
        keywords: "cart checkout basket",
        run: () => navigate("/cart"),
      },
      {
        id: "tracking",
        label: "Track Latest Order",
        keywords: "order tracking live map",
        run: () => navigate("/orders/track"),
      },
      {
        id: "search-pizza",
        label: "Search for Pizza",
        keywords: "pizza search cuisine",
        run: () => {
          dispatch(setSearchQuery("pizza"));
          navigate("/restaurants");
        },
      },
      {
        id: "search-biryani",
        label: "Search for Biryani",
        keywords: "biryani search cuisine",
        run: () => {
          dispatch(setSearchQuery("biryani"));
          navigate("/restaurants");
        },
      },
      {
        id: "home",
        label: "Go Home",
        keywords: "home landing",
        run: () => navigate("/"),
      },
    ];

    if (user?.role === "admin") {
      baseActions.push(
        {
          id: "user-dashboard",
          label: "Open User Dashboard",
          keywords: "user dashboard profile orders",
          run: () => navigate("/user-dashboard"),
        },
        {
          id: "admin-dashboard",
          label: "Open Admin Dashboard",
          keywords: "admin dashboard operations",
          run: () => navigate("/admin"),
        },
        {
          id: "admin-analytics",
          label: "Open Admin Analytics",
          keywords: "admin analytics reports",
          run: () => navigate("/admin/analytics"),
        }
      );
    }

    if (user?.role === "owner") {
      baseActions.push({
        id: "owner-dashboard",
        label: "Open Restaurant Dashboard",
        keywords: "owner restaurant dashboard menu",
        run: () => navigate("/restaurant-dashboard"),
      });
    }

    if (user?.role === "user") {
      baseActions.push({
        id: "user-dashboard",
        label: "Open User Dashboard",
        keywords: "user dashboard profile orders",
        run: () => navigate("/user-dashboard"),
      });
    }

    if (user?.role === "delivery") {
      baseActions.push({
        id: "delivery-dashboard",
        label: "Open Delivery Dashboard",
        keywords: "delivery dashboard rider",
        run: () => navigate("/delivery"),
      });
    }

    return baseActions;
  }, [dispatch, navigate, user?.role]);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return actions;
    }

    return actions.filter((action) => {
      const searchable = `${action.label} ${action.keywords}`.toLowerCase();
      return searchable.includes(normalized);
    });
  }, [actions, query]);

  const runAction = (action) => {
    action.run();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 hidden items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-lg backdrop-blur hover:border-rose-300 hover:text-rose-600 lg:flex dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
      >
        Quick Actions
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Ctrl/Cmd + K
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="mx-auto mt-20 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search actions..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-rose-400 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredActions.length ? (
                filteredActions.map((action) => (
                  <button
                    type="button"
                    key={action.id}
                    onClick={() => runAction(action)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-rose-300"
                  >
                    <span className="font-semibold">{action.label}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">Run</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No actions found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickCommandPalette;
