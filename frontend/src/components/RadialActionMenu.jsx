import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(Boolean(media.matches));
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
};

const forkKnifeIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
    <path
      fill="currentColor"
      d="M6 2c.55 0 1 .45 1 1v7a1 1 0 0 0 2 0V3a1 1 0 1 1 2 0v7a3 3 0 0 1-2 2.83V21a1 1 0 1 1-2 0v-8.17A3 3 0 0 1 5 10V3c0-.55.45-1 1-1Zm11 0c1.66 0 3 1.34 3 3v6c0 1.3-.84 2.4-2 2.82V21a1 1 0 1 1-2 0V2.08c.32-.05.66-.08 1-.08Z"
    />
  </svg>
);

const iconSize = "h-5 w-5";

const iconCuisine = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm6.93 9h-3.18a15.7 15.7 0 0 0-1.05-4.08A8.03 8.03 0 0 1 18.93 11ZM12 4.07c.97 1.33 1.73 3.53 2.07 6.93H9.93C10.27 7.6 11.03 5.4 12 4.07ZM4.07 13h3.18a15.7 15.7 0 0 0 1.05 4.08A8.03 8.03 0 0 1 4.07 13Zm3.18-2H4.07A8.03 8.03 0 0 1 8.3 6.92 15.7 15.7 0 0 0 7.25 11Zm2.68 2h4.14c-.34 3.4-1.1 5.6-2.07 6.93-.97-1.33-1.73-3.53-2.07-6.93Zm4.77 4.08A15.7 15.7 0 0 0 15.75 13h3.18a8.03 8.03 0 0 1-4.23 4.08ZM15.75 11h-7.5A14.2 14.2 0 0 1 12 4.95 14.2 14.2 0 0 1 15.75 11Zm-7.45 2c.29 2.42.9 4.37 1.7 5.62A8.01 8.01 0 0 1 5.07 13h3.23Zm5.7 5.62c.8-1.25 1.41-3.2 1.7-5.62h3.23a8.01 8.01 0 0 1-4.93 5.62Z"
    />
  </svg>
);

const iconTag = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.59 9.59a2 2 0 0 0 2.83 0l4.34-4.34a2 2 0 0 0 0-2.84ZM6.5 7.5A1.5 1.5 0 1 1 8 6a1.5 1.5 0 0 1-1.5 1.5Z"
    />
  </svg>
);

const iconPin = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 3-3 3 3 0 0 1-3 3Z"
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

const iconCart = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSize}>
    <path
      fill="currentColor"
      d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM7.17 14h9.66a2 2 0 0 0 1.9-1.37L21 6H6.21L5.27 3.5A1 1 0 0 0 4.33 3H2v2h1.65l3.6 9.59A2 2 0 0 0 7.17 14Z"
    />
  </svg>
);

const RadialActionMenu = ({
  className = "",
  onScrollToSection,
  sections = {
    cuisines: "cuisines",
    offers: "offers",
    restaurants: "restaurants",
    dishes: "dishes",
    download: "download",
  },
}) => {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const wrapperRef = useRef(null);

  const [isTouchLike, setIsTouchLike] = useState(false);
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(128);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const mq = window.matchMedia?.("(hover: none) and (pointer: coarse)");
      const touch = Boolean(mq?.matches);
      setIsTouchLike(touch);
      setRadius(window.innerWidth < 640 ? 106 : 128);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onDocDown = (event) => {
      const target = event.target;
      if (!wrapperRef.current) return;
      if (target instanceof Node && wrapperRef.current.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, [open]);

  const scrollTo = useCallback(
    (id) => {
      const fn = onScrollToSection;
      if (typeof fn === "function") {
        fn(id);
        return;
      }

      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    },
    [onScrollToSection, reducedMotion]
  );

  const actions = useMemo(
    () => [
      {
        key: "cuisines",
        label: "Explore cuisines",
        icon: iconCuisine,
        onActivate: () => scrollTo(sections.cuisines),
        colorClass: "from-saffron-400/30 via-cream-50 to-roast-100 dark:from-saffron-400/18 dark:to-slate-900",
      },
      {
        key: "offers",
        label: "Offers",
        icon: iconTag,
        onActivate: () => scrollTo(sections.offers),
        colorClass: "from-spice-300/28 via-cream-50 to-rose-100 dark:from-spice-300/18 dark:to-slate-900",
      },
      {
        key: "nearby",
        label: "Nearby restaurants",
        icon: iconPin,
        onActivate: () => scrollTo(sections.restaurants),
        colorClass: "from-leaf-500/22 via-cream-50 to-emerald-100 dark:from-leaf-500/12 dark:to-slate-900",
      },
      {
        key: "fast",
        label: "Fast delivery",
        icon: iconBolt,
        onActivate: () => navigate("/restaurants?sort=fast_delivery"),
        colorClass: "from-sky-300/22 via-cream-50 to-sky-100 dark:from-sky-300/12 dark:to-slate-900",
      },
      {
        key: "top",
        label: "Top rated",
        icon: iconStar,
        onActivate: () => navigate("/restaurants?sort=top_rated"),
        colorClass: "from-gold-200/36 via-cream-50 to-amber-100 dark:from-gold-200/18 dark:to-slate-900",
      },
      {
        key: "cart",
        label: "Cart / quick order",
        icon: iconCart,
        href: "/cart",
        colorClass: "from-roast-400/24 via-cream-50 to-orange-100 dark:from-roast-400/14 dark:to-slate-900",
      },
    ],
    [navigate, scrollTo, sections]
  );

  const anglesDeg = useMemo(() => [-90, -30, 30, 90, 150, 210], []);

  const handleHubClick = () => setOpen((v) => !v);

  const wrapperHandlers = isTouchLike
    ? {}
    : {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocusCapture: () => setOpen(true),
        onBlurCapture: (event) => {
          if (!wrapperRef.current) return;
          const next = event.relatedTarget;
          if (next instanceof Node && wrapperRef.current.contains(next)) return;
          setOpen(false);
        },
      };

  return (
    <div
      ref={wrapperRef}
      className={["relative", className].join(" ")}
      aria-label="Quick actions"
      {...wrapperHandlers}
    >
      <div className="absolute inset-0 -z-10">
        <div
          className={[
            "pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "bg-[radial-gradient(circle_at_50%_50%,rgba(244,63,94,0.22),transparent_60%)] blur-xl",
            open ? "opacity-100" : "opacity-0",
            "transition-opacity duration-500",
            "motion-reduce:transition-none",
          ].join(" ")}
        />

        <div
          className={[
            "pointer-events-none absolute left-1/2 top-1/2 h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full",
            "border border-slate-900/10 dark:border-white/10",
            open ? "opacity-100" : "opacity-0",
            "transition-opacity duration-500 motion-reduce:transition-none",
          ].join(" ")}
        />
      </div>

      <div className="relative h-[300px] w-[300px] sm:h-[320px] sm:w-[320px]">
        {actions.map((action, index) => {
          const angleRad = (anglesDeg[index] * Math.PI) / 180;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;

          const base = [
            "absolute left-1/2 top-1/2",
            "transition-[transform,opacity] duration-500",
            "motion-reduce:transition-none",
            open ? "opacity-100" : "pointer-events-none opacity-0",
            "focus-within:pointer-events-auto",
          ].join(" ");

          const transform = open
            ? `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1)`
            : "translate(-50%, -50%) translate(0px, 0px) scale(0.68)";

          const style = { transform };

          const buttonClasses = [
            "group grid h-14 w-14 place-items-center rounded-full border border-white/55",
            "bg-white/70 text-slate-900 shadow-premium backdrop-blur",
            "transition hover:-translate-y-0.5 hover:shadow-lift",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
            "dark:border-slate-700/70 dark:bg-slate-950/55 dark:text-slate-50",
            `bg-gradient-to-br ${action.colorClass}`,
          ].join(" ");

          const content = (
            <span className="relative grid place-items-center">
              <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.55),transparent_55%)] opacity-70" />
              <span className="relative">{action.icon}</span>
            </span>
          );

          const label = (
            <span
              className={[
                "mt-1.5 max-w-[92px] text-center text-[11px] font-extrabold leading-tight",
                "text-slate-700 dark:text-slate-200",
                "[text-wrap:balance]",
              ].join(" ")}
            >
              {action.label}
            </span>
          );

          if (action.href) {
            return (
              <div key={action.key} className={base} style={style}>
                <div className="flex flex-col items-center">
                  <Link to={action.href} className={buttonClasses} aria-label={action.label} title={action.label}>
                    {content}
                  </Link>
                  {label}
                </div>
              </div>
            );
          }

          return (
            <div key={action.key} className={base} style={style}>
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  className={buttonClasses}
                  aria-label={action.label}
                  title={action.label}
                  onClick={() => {
                    action.onActivate?.();
                    setOpen(false);
                  }}
                >
                  {content}
                </button>
                {label}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          className={[
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "grid h-[92px] w-[92px] place-items-center rounded-full",
            "border border-white/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
            "text-white shadow-premium",
            "transition duration-300 hover:shadow-lift",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-spice-300",
            "dark:border-slate-700/70",
          ].join(" ")}
          onClick={handleHubClick}
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(250,204,21,0.28),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,0.28),transparent_40%)] opacity-90" />
          <span className="relative flex flex-col items-center gap-1">
            <span className={["grid h-9 w-9 place-items-center rounded-2xl", open ? "animate-pop" : ""].join(" ")}>
              {forkKnifeIcon}
            </span>
            <span className="text-[11px] font-black tracking-wide text-white/90">Quick</span>
          </span>
        </button>
      </div>

      <p className="mt-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
        {isTouchLike ? "Tap Quick" : "Hover Quick"}
      </p>
    </div>
  );
};

export default RadialActionMenu;
