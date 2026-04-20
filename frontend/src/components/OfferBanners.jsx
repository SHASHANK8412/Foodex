import { useEffect, useMemo, useState } from "react";

const fallbackOffers = [
  { title: "Flat 30% OFF", code: "FOODEX30", sub: "On orders above Rs.499" },
  { title: "Free Delivery", code: "FASTFREE", sub: "Valid for first 3 orders" },
  { title: "Midnight Cravings", code: "NIGHT20", sub: "20% OFF after 10PM" },
];

const OfferBanners = ({ offers = [] }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const sourceOffers = useMemo(() => {
    return offers.length ? offers : fallbackOffers;
  }, [offers]);

  useEffect(() => {
    if (!sourceOffers.length) {
      return undefined;
    }

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % sourceOffers.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [sourceOffers]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Live Offers</p>
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          rotates automatically
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sourceOffers.map((offer, index) => (
        <article
          key={offer.code}
          className={
            "group rounded-2xl border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 " +
            (index === activeIndex ? "ring-2 ring-rose-300 dark:ring-rose-500/40" : "")
          }
        >
          <p className="text-lg font-black text-slate-900 dark:text-slate-100">{offer.title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{offer.sub}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white dark:bg-rose-500">{offer.code}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {index === activeIndex ? "active" : "queued"}
            </span>
          </div>
        </article>
        ))}
      </div>
    </section>
  );
};

export default OfferBanners;
