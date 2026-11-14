import { useEffect, useState } from "react";
import { ChevronRight, Clock, Search } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchRestaurantById } from "../redux/slices/restaurantSlice";
import { fetchDemandForecast } from "../redux/slices/analyticsSlice";
import MenuItemCard, { DietMark } from "../components/MenuItemCard";
import { formatCurrency } from "../utils/format";
import SemanticSearchPanel from "../components/SemanticSearchPanel";
import RecommendationCarousel from "../components/RecommendationCarousel";
import { fetchAiRecommendations } from "../redux/slices/aiSlice";
import { addToast } from "../redux/slices/uiSlice";
import api from "../services/api";
import { track } from "../services/tracker";

const RestaurantMenuPage = () => {
  const { restaurantId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedRestaurant, loading, error } = useSelector((state) => state.restaurants);
  const { demandForecast } = useSelector((state) => state.analytics);
  const aiRecommendations = useSelector((state) => state.ai.recommendations);
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const cartItems = useSelector((state) => state.cart.items);
  const [vegOnly, setVegOnly] = useState(false);
  const [dishQuery, setDishQuery] = useState("");

  useEffect(() => {
    dispatch(fetchRestaurantById(restaurantId));
    dispatch(fetchDemandForecast(restaurantId));
    dispatch(fetchAiRecommendations(restaurantId));
    track("restaurant_view", { restaurantId, path: `/restaurants/${restaurantId}` });
  }, [dispatch, restaurantId]);

  if (loading) {
    return <p className="rounded-2xl bg-white p-6 dark:bg-slate-900">Loading menu...</p>;
  }

  if (error) {
    return <p className="rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error}</p>;
  }

  if (!selectedRestaurant?.restaurant) {
    return <p className="rounded-2xl bg-white p-6 text-sm dark:bg-slate-900">Restaurant not found.</p>;
  }

  const { restaurant, menu = [] } = selectedRestaurant;
  const isOpen = restaurant.isOpen !== false;
  const categories = Array.from(new Set(menu.map((item) => item.category).filter(Boolean)));
  const needle = dishQuery.trim().toLowerCase();
  const visible = menu.filter(
    (item) =>
      (!vegOnly || item.isVeg) &&
      (!needle || [item.name, item.description, item.category, ...(item.tags || [])].join(" ").toLowerCase().includes(needle))
  );
  const popular = visible.filter((item) => item.recommended);
  const groups = [
    ...(popular.length && !needle ? [["Popular", popular]] : []),
    ...categories.map((category) => [category, visible.filter((item) => item.category === category)]).filter(([, items]) => items.length),
  ];

  const cartHere = cartItems.filter((line) => line.restaurantId === restaurantId);
  const cartCount = cartHere.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cartHere.reduce((sum, line) => sum + line.price * line.quantity, 0);

  // Only show a busy hour when there is order history behind it.
  const peak = demandForecast?.expectedOrdersAtPeak > 0 ? demandForecast.peakHour : null;
  const formatHour = (hour) => `${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}`;

  const sectionId = (name) => `menu-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const startGroupOrder = async () => {
    try {
      const response = await api.post("/group-orders", { restaurantId });
      const code = response.data?.data?.inviteCode;
      if (!code) {
        throw new Error("Failed to create group order");
      }

      navigate(`/group-order/${code}`);
      dispatch(addToast({ type: "success", message: "Group order created. Share your invite link." }));
    } catch (groupError) {
      dispatch(addToast({ type: "error", message: groupError.message || "Unable to start group order" }));
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-600">{(restaurant.cuisine || []).join(" · ") || "Menu"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{restaurant.name}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{restaurant.description || "Freshly prepared delights from this kitchen."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">⭐ {restaurant.rating ?? "4.2"}</span>
          {isOpen ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">
              <Clock size={12} aria-hidden="true" /> About {restaurant.deliveryMinutes ?? (restaurant.estimatedWaitMinutes || 20) + 15} min
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-200">Closed now</span>
          )}
          {restaurant.address?.city && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{restaurant.address.city}</span>
          )}
          {peak !== null && (
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
              Usually busiest around {formatHour(peak)}
            </span>
          )}
        </div>
        {!isOpen && (
          <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            This kitchen is closed right now. You can browse the menu; ordering opens when they do.
          </p>
        )}
      </header>

      <div className="sticky top-16 z-20 -mx-4 space-y-3 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Search this menu</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={dishQuery}
              onChange={(event) => setDishQuery(event.target.value)}
              placeholder={`Search ${restaurant.name}`}
              className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={vegOnly}
            onClick={() => setVegOnly((value) => !value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
              vegOnly
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <DietMark isVeg /> Veg only
          </button>
        </div>
        {groups.length > 1 && (
          <nav aria-label="Menu sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {groups.map(([name]) => (
              <a
                key={name}
                href={`#${sectionId(name)}`}
                className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700 dark:border-slate-700 dark:text-slate-200"
              >
                {name}
              </a>
            ))}
          </nav>
        )}
      </div>

      {groups.length ? (
        groups.map(([name, items]) => (
          <section key={name} id={sectionId(name)} className="scroll-mt-44 space-y-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {name} <span className="text-sm font-semibold text-slate-500">({items.length})</span>
            </h2>
            {items.map((item) => (
              <MenuItemCard key={`${name}-${item._id}`} item={item} restaurantId={restaurantId} restaurantName={restaurant.name} disabled={!isOpen} />
            ))}
          </section>
        ))
      ) : (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          {menu.length ? "No dishes match. Try another search or turn off Veg only." : "No menu items available right now."}
        </p>
      )}

      {isAuthenticated && ["user", "admin"].includes(user?.role) && isOpen && (
        <button
          type="button"
          onClick={startGroupOrder}
          className="inline-flex rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-100"
        >
          Start a group order
        </button>
      )}

      <SemanticSearchPanel restaurantId={restaurantId} />
      <RecommendationCarousel title="You may also like" items={aiRecommendations.mayLike} />

      {cartCount > 0 && (
        <Link
          to="/cart"
          className="fixed inset-x-4 bottom-20 z-[85] flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-2xl lg:bottom-6 lg:left-6 lg:right-auto lg:w-[28rem]"
        >
          <span className="text-sm font-semibold">
            {cartCount} {cartCount === 1 ? "item" : "items"} · {formatCurrency(cartSubtotal)}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold">
            View cart <ChevronRight size={16} aria-hidden="true" />
          </span>
        </Link>
      )}
    </div>
  );
};

export default RestaurantMenuPage;
