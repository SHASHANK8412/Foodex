import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setSearchQuery } from "../../redux/slices/uiSlice";
import RadialActionMenu from "../RadialActionMenu";
import Reveal from "../Reveal";

const DishCard = ({ title, subtitle, price, accentClass = "" }) => {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/45 bg-white/70 p-4 shadow-premium backdrop-blur",
        "dark:border-slate-700/70 dark:bg-slate-950/50",
        accentClass,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-80 [background:radial-gradient(circle_at_25%_20%,rgba(250,204,21,0.22),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(244,63,94,0.16),transparent_55%)]" />
      <div className="relative space-y-1">
        <p className="text-sm font-black text-slate-900 dark:text-slate-50">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        {price ? <p className="pt-2 text-xs font-extrabold text-slate-900 dark:text-slate-50">{price}</p> : null}
      </div>
    </div>
  );
};

const HeroVisual = () => {
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[2rem] border border-orange-100/70 bg-white/55 shadow-premium backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/35">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(250,204,21,0.22),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(244,63,94,0.18),transparent_52%),radial-gradient(circle_at_70%_85%,rgba(249,115,22,0.16),transparent_58%)]" />
        <div className="relative grid min-h-[340px] grid-cols-6 gap-4 p-6 sm:min-h-[380px] sm:p-8">
          <div className="col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-700 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/45 dark:text-slate-200">
              Today’s picks
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-spice-500 to-orange-400" />
            </div>
          </div>

          <div className="col-span-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <DishCard
                title="Saffron Butter Chicken"
                subtitle="Velvety, aromatic, indulgent"
                price="from ₹329"
                accentClass="bg-gradient-to-br from-gold-200/20 via-white/60 to-orange-100/60 dark:from-gold-200/10"
              />
              <DishCard
                title="Truffle Mushroom Pizza"
                subtitle="Crisp base, luxe finish"
                price="from ₹399"
                accentClass="bg-gradient-to-br from-slate-100/70 via-white/60 to-amber-100/55 dark:from-slate-900/40"
              />
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-gradient-to-br from-spice-300/35 to-transparent blur-2xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full bg-gradient-to-br from-gold-200/35 to-transparent blur-2xl" />

              <div className="relative grid h-full place-items-center">
                <div className="relative grid h-[210px] w-[210px] place-items-center rounded-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-premium sm:h-[235px] sm:w-[235px]">
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(250,204,21,0.28),transparent_42%),radial-gradient(circle_at_70%_85%,rgba(244,63,94,0.26),transparent_46%),radial-gradient(circle_at_60%_55%,rgba(249,115,22,0.22),transparent_48%)] opacity-90" />
                  <div className="relative text-center">
                    <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/70">Fastest route</p>
                    <p className="mt-2 text-2xl font-black text-white">15–25 min</p>
                    <p className="mt-1 text-xs font-semibold text-white/80">Live tracking included</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute -bottom-8 left-1/2 -translate-x-1/2 sm:-bottom-10">
        <RadialActionMenu className="scale-[0.92] sm:scale-100" />
      </div>
    </div>
  );
};

const HeroSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const globalQuery = useSelector((state) => state.ui.searchQuery);
  const [query, setQuery] = useState(globalQuery || "");

  const chips = useMemo(
    () => [
      { label: "4.8+ rated", sub: "Top kitchens" },
      { label: "15–25 min", sub: "Fast delivery" },
      { label: "Live tracking", sub: "Real-time updates" },
    ],
    []
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(setSearchQuery(query));

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    navigate(qs ? `/restaurants?${qs}` : "/restaurants");
  };

  return (
    <section className="premium-surface grain-overlay px-5 py-10 sm:px-10 sm:py-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-7">
          <Reveal>
            <p className="section-kicker">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-spice-500 to-orange-400" />
              Warm meals. Premium experience.
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <h1 className="text-4xl font-black leading-[1.04] text-slate-900 dark:text-slate-50 sm:text-6xl">
              Make your next bite feel
              {" "}
              <span className="bg-gradient-to-r from-spice-700 via-roast-500 to-saffron-500 bg-clip-text font-black text-transparent">
                cinematic.
              </span>
            </h1>
          </Reveal>

          <Reveal delayMs={130}>
            <p className="max-w-xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
              Search incredible restaurants, discover signature dishes, and checkout effortlessly — with a UI crafted to make food feel irresistible.
            </p>
          </Reveal>

          <Reveal delayMs={170}>
            <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1.6fr,auto] sm:items-center">
              <label className="sr-only" htmlFor="home-search">
                Search restaurants, dishes, cuisines
              </label>
              <input
                id="home-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-premium"
                placeholder="Search biryani, pizza, sushi, dosa…"
                autoComplete="off"
              />
              <button type="submit" className="btn-primary whitespace-nowrap">
                Find food
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <div
                  key={chip.label}
                  className="rounded-2xl border border-orange-100/70 bg-white/70 px-4 py-2 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/40"
                >
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-50">{chip.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{chip.sub}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal className="relative pb-10 sm:pb-12">
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
};

export default HeroSection;
