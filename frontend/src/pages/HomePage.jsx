import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchRecommendations } from "../redux/slices/analyticsSlice";
import { fetchRestaurants } from "../redux/slices/restaurantSlice";
import Reveal from "../components/Reveal";
import LandingSection from "../components/landing/LandingSection";
import HeroSection from "../components/landing/HeroSection";
import CuratedCollections from "../components/landing/CuratedCollections";
import FeaturedCuisines from "../components/landing/FeaturedCuisines";
import PopularRestaurantsShowcase from "../components/landing/PopularRestaurantsShowcase";
import BestSellingDishes from "../components/landing/BestSellingDishes";
import SpecialOffers from "../components/landing/SpecialOffers";
import Testimonials from "../components/landing/Testimonials";
import DownloadCTA from "../components/landing/DownloadCTA";

const HomePage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { recommendations } = useSelector((state) => state.analytics);

  useEffect(() => {
    dispatch(fetchRestaurants());
    if (user) {
      dispatch(fetchRecommendations());
    }
  }, [dispatch, user]);

  return (
    <div className="space-y-16 pb-10">
      <HeroSection />

      <CuratedCollections />

      <FeaturedCuisines />

      <PopularRestaurantsShowcase />

      {Boolean(user && recommendations.length) && (
        <LandingSection
          id="for-you"
          kicker="Personalized"
          title="Recommended for you"
          subtitle="Spark-powered picks tuned to what you’ll actually want to eat next."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.slice(0, 6).map((item, idx) => (
              <Reveal key={item.restaurantId + String(item.rank)} delayMs={60 + idx * 60}>
                <Link
                  to={"/restaurants/" + item.restaurantId}
                  className={[
                    "group relative overflow-hidden rounded-[1.5rem] border border-orange-100/70 bg-white/70 p-5 shadow-sm backdrop-blur",
                    "transition hover:-translate-y-1 hover:shadow-lift",
                    "dark:border-slate-800/70 dark:bg-slate-950/40",
                  ].join(" ")}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.12),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(250,204,21,0.12),transparent_55%)]" />
                  <div className="relative space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-slate-50">
                        {item.restaurantName || "Recommended Restaurant"}
                      </p>
                      <span className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-extrabold text-white dark:bg-rose-500">
                        Score {Number(item.score || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Because you ordered similar cuisines</p>
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-900/80 dark:text-slate-50/80">
                      Open menu
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </LandingSection>
      )}

      <BestSellingDishes />

      <SpecialOffers />

      <Testimonials />

      <DownloadCTA />

      <Reveal>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/orders/track" className="btn-ghost">
            Track an order
          </Link>
          <Link to="/cart" className="btn-primary">
            Go to cart
          </Link>
        </div>
      </Reveal>
    </div>
  );
};

export default HomePage;
