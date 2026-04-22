import LandingSection from "./LandingSection";
import Reveal from "../Reveal";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setSearchQuery } from "../../redux/slices/uiSlice";

const withBase = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;

const cuisines = [
  {
    name: "Indian",
    note: "Spice, soul, comfort",
    accent: "from-roast-500/25 via-cream-50 to-saffron-100",
    thumb: {
      src: withBase("/cuisines/indian.jpg"),
      alt: "Indian cuisine",
    },
  },
  {
    name: "Italian",
    note: "Pasta, pizza, joy",
    accent: "from-spice-300/25 via-cream-50 to-orange-100",
    thumb: {
      src: withBase("/cuisines/italian.jpg"),
      alt: "Italian cuisine",
    },
  },
  {
    name: "Japanese",
    note: "Clean & crafted",
    accent: "from-slate-200/50 via-cream-50 to-sky-100",
    thumb: {
      src: withBase("/cuisines/japanese.jpg"),
      alt: "Japanese cuisine",
    },
  },
  {
    name: "Mexican",
    note: "Bold & crunchy",
    accent: "from-gold-200/35 via-cream-50 to-roast-100",
    thumb: {
      src: withBase("/cuisines/mexican.jpg"),
      alt: "Mexican cuisine",
    },
  },
  {
    name: "Healthy",
    note: "Fresh greens",
    accent: "from-leaf-500/20 via-cream-50 to-emerald-100",
    thumb: {
      src: withBase("/cuisines/healthy.jpg"),
      alt: "Healthy food",
    },
  },
  {
    name: "Desserts",
    note: "Sweet finish",
    accent: "from-rose-200/35 via-cream-50 to-amber-100",
    thumb: {
      src: withBase("/cuisines/desserts.jpg"),
      alt: "Desserts",
    },
  },
];

const FeaturedCuisines = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (
    <LandingSection
      id="cuisines"
      kicker="Featured Cuisines"
      title="Pick a vibe. We’ll handle the cravings."
      subtitle="Elegant discovery that feels effortless — explore categories designed to guide hungry decisions fast."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cuisines.map((cuisine, idx) => (
          <Reveal key={cuisine.name} delayMs={50 + idx * 40}>
            <button
              type="button"
              onClick={() => {
                dispatch(setSearchQuery(cuisine.name));
                const params = new URLSearchParams();
                params.set("q", cuisine.name);
                navigate(`/restaurants?${params.toString()}`);
              }}
              className={[
                "group relative w-full overflow-hidden rounded-[1.5rem] border border-orange-100/70 bg-white/70 p-6 text-left shadow-sm backdrop-blur",
                "transition hover:-translate-y-0.5 hover:shadow-lift",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
                "dark:border-slate-800/70 dark:bg-slate-950/40",
              ].join(" ")}
            >
              <div className={"pointer-events-none absolute inset-0 bg-gradient-to-br " + cuisine.accent} />
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <p className="text-xl font-black text-slate-900 dark:text-slate-50">{cuisine.name}</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{cuisine.note}</p>
                  <div className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold text-slate-900/80 dark:text-slate-50/80">
                    Explore
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                </div>

                <div
                  className={[
                    "shrink-0 self-center",
                    "grid h-[88px] w-[88px] place-items-center rounded-[1.35rem]",
                    "border border-white/60 bg-white/65 shadow-sm backdrop-blur",
                    "overflow-hidden",
                    "transition-transform duration-200 group-hover:scale-[1.02]",
                    "dark:border-slate-700/55 dark:bg-slate-950/45 dark:text-slate-50/75",
                  ].join(" ")}
                >
                  <img
                    src={cuisine.thumb.src}
                    alt={cuisine.thumb.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </button>
          </Reveal>
        ))}
      </div>
    </LandingSection>
  );
};

export default FeaturedCuisines;
