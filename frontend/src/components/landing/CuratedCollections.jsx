import { useMemo } from "react";
import { Link } from "react-router-dom";
import LandingSection from "./LandingSection";
import Reveal from "../Reveal";

const iconSize = "h-5 w-5";

const iconMoon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M20.74 15.47A8.97 8.97 0 0 1 12 21 9 9 0 0 1 9.06 3.5a.9.9 0 0 1 1.06 1.09A7.2 7.2 0 0 0 10 6a7 7 0 0 0 7 7 7.2 7.2 0 0 0 1.41-.12.9.9 0 0 1 1.09 1.06c-.14.55-.37 1.05-.77 1.53Z"
    />
  </svg>
);

const iconLeaf = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M20 4c-7.2 0-13 5.8-13 13 0 1.2.16 2.35.46 3.44a1 1 0 0 0 1.16.7C16.84 19.4 22 12.46 22 6a2 2 0 0 0-2-2ZM9.9 18.1c.85-4.43 3.67-7.25 8.2-8.2-1.3 4.63-4.07 7.4-8.2 8.2Z"
    />
  </svg>
);

const iconDessert = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M7 4a5 5 0 0 1 10 0v1h1a2 2 0 0 1 2 2v2a7 7 0 0 1-5 6.7V19h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h2v-3.3A7 7 0 0 1 4 9V7a2 2 0 0 1 2-2h1V4Zm2 1h6V4a3 3 0 0 0-6 0v1Z"
    />
  </svg>
);

const iconBolt = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path fill="currentColor" d="M13 2 3 14h7l-1 8 12-14h-7l-1-6Z" />
  </svg>
);

const iconStar = (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M9.99 1.5l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L9.99 1.5z"
    />
  </svg>
);

const iconGlobe = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.93 9h-3.18a15.7 15.7 0 0 0-1.05-4.08A8.03 8.03 0 0 1 18.93 11ZM12 4.07c.97 1.33 1.73 3.53 2.07 6.93H9.93C10.27 7.6 11.03 5.4 12 4.07ZM4.07 13h3.18a15.7 15.7 0 0 0 1.05 4.08A8.03 8.03 0 0 1 4.07 13Zm3.18-2H4.07A8.03 8.03 0 0 1 8.3 6.92 15.7 15.7 0 0 0 7.25 11Z"
    />
  </svg>
);

const buildRestaurantsUrl = (paramsObject) => {
  const params = new URLSearchParams();
  Object.entries(paramsObject || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const v = String(value).trim();
    if (!v) return;
    params.set(key, v);
  });
  const qs = params.toString();
  return qs ? `/restaurants?${qs}` : "/restaurants";
};

const CuratedCollections = () => {
  const rails = useMemo(
    () => [
      {
        key: "late-night",
        title: "Late Night",
        subtitle: "Comfort picks, zero effort",
        icon: iconMoon,
        to: buildRestaurantsUrl({ sort: "fast_delivery" }),
        accent:
          "from-slate-200/70 via-cream-50 to-sky-100 dark:from-slate-900/50 dark:via-slate-950/30 dark:to-sky-500/10",
      },
      {
        key: "healthy",
        title: "Healthy & Light",
        subtitle: "Fresh, clean, satisfying",
        icon: iconLeaf,
        to: buildRestaurantsUrl({ cuisine: "Healthy" }),
        accent:
          "from-leaf-500/18 via-cream-50 to-emerald-100 dark:from-emerald-500/10 dark:via-slate-950/30 dark:to-emerald-500/10",
      },
      {
        key: "desserts",
        title: "Desserts",
        subtitle: "Sweet finish, fast delivery",
        icon: iconDessert,
        to: buildRestaurantsUrl({ cuisine: "Desserts" }),
        accent:
          "from-rose-200/28 via-cream-50 to-amber-100 dark:from-rose-500/10 dark:via-slate-950/30 dark:to-amber-500/10",
      },
      {
        key: "fast",
        title: "Fast Delivery",
        subtitle: "15–25 minutes energy",
        icon: iconBolt,
        to: buildRestaurantsUrl({ sort: "fast_delivery" }),
        accent:
          "from-sky-200/30 via-cream-50 to-saffron-100 dark:from-sky-500/10 dark:via-slate-950/30 dark:to-saffron-500/10",
      },
      {
        key: "top",
        title: "Top Rated",
        subtitle: "4.5+ favourites",
        icon: iconStar,
        to: buildRestaurantsUrl({ sort: "top_rated" }),
        accent:
          "from-gold-200/40 via-cream-50 to-orange-100 dark:from-amber-500/12 dark:via-slate-950/30 dark:to-orange-500/10",
      },
      {
        key: "world",
        title: "Global Cuisines",
        subtitle: "Explore what you’re craving",
        icon: iconGlobe,
        to: buildRestaurantsUrl({}),
        accent:
          "from-roast-500/18 via-cream-50 to-spice-200/30 dark:from-orange-500/10 dark:via-slate-950/30 dark:to-rose-500/10",
      },
    ],
    []
  );

  return (
    <LandingSection
      id="collections"
      kicker="Collections"
      title="Curated rails that feel like a magazine"
      subtitle="Tap a mood to jump straight into a filtered, sortable restaurant list — shareable links included."
    >
      <div className="-mx-2 overflow-x-auto px-2 pb-2">
        <div className="flex min-w-max gap-3">
          {rails.map((rail, idx) => (
            <Reveal key={rail.key} delayMs={40 + idx * 40} className="shrink-0">
              <Link
                to={rail.to}
                className={[
                  "group relative block w-[240px] overflow-hidden rounded-[1.5rem] border border-orange-100/70 bg-white/70 p-5 shadow-sm backdrop-blur",
                  "transition hover:-translate-y-0.5 hover:shadow-lift",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
                  "dark:border-slate-800/70 dark:bg-slate-950/40",
                ].join(" ")}
              >
                <div className={"pointer-events-none absolute inset-0 bg-gradient-to-br " + rail.accent} />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/45 blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{rail.title}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{rail.subtitle}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-slate-900/80 dark:text-slate-50/80">
                      Explore
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </div>

                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/55 bg-white/70 text-slate-900 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/45 dark:text-slate-50">
                    {rail.icon}
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </LandingSection>
  );
};

export default CuratedCollections;
