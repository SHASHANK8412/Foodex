import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchRecommendations } from "../redux/slices/analyticsSlice";
import OfferBanners from "../components/OfferBanners";
import { fetchAiRecommendations, fetchQuickReorder } from "../redux/slices/aiSlice";
import RecommendationCarousel from "../components/RecommendationCarousel";
import QuickReorderCard from "../components/QuickReorderCard";
import SemanticSearchPanel from "../components/SemanticSearchPanel";
import { fetchRestaurants } from "../redux/slices/restaurantSlice";
import { fetchOrders } from "../redux/slices/orderSlice";

const HomePage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { recommendations } = useSelector((state) => state.analytics);
  const aiRecommendations = useSelector((state) => state.ai.recommendations);
  const quickReorder = useSelector((state) => state.ai.quickReorder);
  const { restaurants } = useSelector((state) => state.restaurants);
  const { orders } = useSelector((state) => state.orders);
  const [heroCopyIndex, setHeroCopyIndex] = useState(0);

  const heroCopy = useMemo(
    () => [
      "Cravings delivered with speed, style, and live tracking.",
      "Real kitchens, realtime demand, lightning-fast checkout.",
      "From trending restaurants to doorstep updates in one flow.",
    ],
    []
  );

  const openRestaurants = useMemo(
    () => restaurants.filter((restaurant) => restaurant.isOpen !== false),
    [restaurants]
  );

  const dynamicOffers = useMemo(() => {
    const city = openRestaurants[0]?.address?.city || "your area";
    const busyRestaurant =
      openRestaurants.find((restaurant) => restaurant.demandLevel === "high") || openRestaurants[0];

    return [
      {
        title: `${Math.min(40, 15 + openRestaurants.length)}% OFF in ${city}`,
        code: `CITY${Math.max(10, openRestaurants.length * 2)}`,
        sub: `${openRestaurants.length || 0} restaurants currently open near you`,
      },
      {
        title: "Instant Reorder Deal",
        code: quickReorder.length ? "REPEAT15" : "WELCOME10",
        sub: quickReorder.length
          ? `Save on your top ${Math.min(quickReorder.length, 3)} AI-predicted reorders`
          : "Unlock discount on your first quick reorder",
      },
      {
        title: "Kitchen Rush Flash",
        code: busyRestaurant ? "RUSH20" : "FASTFREE",
        sub: busyRestaurant
          ? `${busyRestaurant.name} is trending. Grab priority slot now.`
          : "Free delivery window active for selected kitchens",
      },
    ];
  }, [openRestaurants, quickReorder]);

  const pulseStats = useMemo(
    () => [
      {
        label: "AI Picks",
        value: String((aiRecommendations.mayLike || []).length + (aiRecommendations.trending || []).length).padStart(2, "0"),
        hint: "personalized suggestions now",
        accent: "from-rose-500/20 to-orange-400/20",
      },
      {
        label: "Quick Reorder",
        value: String((quickReorder || []).length).padStart(2, "0"),
        hint: "ready one-tap repeats",
        accent: "from-emerald-500/20 to-cyan-400/20",
      },
      {
        label: "Spark Insights",
        value: String((recommendations || []).length).padStart(2, "0"),
        hint: "data-ranked restaurants",
        accent: "from-violet-500/20 to-fuchsia-400/20",
      },
      {
        label: "Open Kitchens",
        value: String(openRestaurants.length).padStart(2, "0"),
        hint: "available right now",
        accent: "from-cyan-500/20 to-indigo-400/20",
      },
    ],
    [aiRecommendations.mayLike, aiRecommendations.trending, quickReorder, recommendations, openRestaurants.length]
  );

  const orderMix = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    return {
      placed: safeOrders.filter((order) => order.status === "pending").length,
      inKitchen: safeOrders.filter((order) => ["confirmed", "preparing"].includes(order.status)).length,
      onRoute: safeOrders.filter((order) => order.status === "out_for_delivery").length,
      completed: safeOrders.filter((order) => order.status === "delivered").length,
    };
  }, [orders]);

  const deliveryJourney = useMemo(
    () => [
      {
        step: "01",
        title: "Select",
        text: `${restaurants.length || 0} restaurants discovered in your feed.`,
      },
      {
        step: "02",
        title: "Confirm",
        text: `${orderMix.placed + orderMix.inKitchen} active checkouts and kitchen confirmations in pipeline.`,
      },
      {
        step: "03",
        title: "Track",
        text: `${orderMix.onRoute} orders currently moving with live tracking updates.`,
      },
      {
        step: "04",
        title: "Enjoy",
        text: `${orderMix.completed} deliveries completed in your latest order timeline.`,
      },
    ],
    [restaurants.length, orderMix]
  );

  const dynamicFeatureCards = useMemo(
    () => [
      {
        title: "Curated restaurants",
        text: `${openRestaurants.length || 0} kitchens are open and ready to serve right now.`,
      },
      {
        title: "Fast checkout",
        text: `${quickReorder.length || 0} AI quick-reorder suggestions available for one-tap carting.`,
      },
      {
        title: "Live map-like updates",
        text: `${orderMix.onRoute} deliveries are broadcasting active journey updates.`,
      },
    ],
    [openRestaurants.length, quickReorder.length, orderMix.onRoute]
  );

  useEffect(() => {
    dispatch(fetchRestaurants());

    if (user) {
      dispatch(fetchRecommendations());
      dispatch(fetchAiRecommendations());
      dispatch(fetchQuickReorder());
      dispatch(fetchOrders());
    }
  }, [dispatch, user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroCopyIndex((prev) => (prev + 1) % heroCopy.length);
    }, 4200);

    return () => clearInterval(interval);
  }, [heroCopy]);

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-orange-100 bg-white px-6 py-10 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-orange-200/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-rose-200/60 blur-2xl" />
        <div className="relative max-w-3xl space-y-6">
          <p className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-rose-700">
            Food delivery reimagined
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl">
            {heroCopy[heroCopyIndex]}
          </h1>
          <p className="max-w-2xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            Discover top restaurants, build your cart, checkout in seconds, and track every movement of your order from kitchen to doorstep.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/restaurants" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-700">
              Explore restaurants
            </Link>
            <Link to="/orders/track" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              Track order
            </Link>
          </div>
        </div>
      </section>

      <OfferBanners offers={dynamicOffers} />

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 sm:p-8">
        <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-rose-300/30 blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-0 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Foodex Pulse</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Live Intelligence Panel</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white dark:bg-slate-100 dark:text-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pulseStats.map((stat) => (
            <article
              key={stat.label}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.accent}`} />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{stat.hint}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
                    style={{ width: `${Math.min(100, Number(stat.value) * 8 || 24)}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">Delivery Journey</h2>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
            ultra-fast pipeline
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {deliveryJourney.map((item) => (
            <article key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-600">Step {item.step}</p>
              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <SemanticSearchPanel />

      {user && <QuickReorderCard items={quickReorder} />}

      <RecommendationCarousel title="You may also like" items={aiRecommendations.mayLike} />
      <RecommendationCarousel title="Trending near you" items={aiRecommendations.trending} />

      <section className="grid gap-4 md:grid-cols-3">
        {dynamicFeatureCards.map((item) => (
          <article key={item.title} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
          </article>
        ))}
      </section>

      {Boolean(user && recommendations.length) && (
        <section className="space-y-4 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Recommended for you</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-rose-600">Spark-powered</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.slice(0, 6).map((item) => (
              <Link
                key={item.restaurantId + String(item.rank)}
                to={"/restaurants/" + item.restaurantId}
                className="rounded-2xl border border-slate-200 p-4 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.restaurantName || "Recommended Restaurant"}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Score: {item.score}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;
