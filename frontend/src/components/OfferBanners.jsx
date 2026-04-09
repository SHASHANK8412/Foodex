const offers = [
  { title: "Flat 30% OFF", code: "FOODEX30", sub: "On orders above Rs.499" },
  { title: "Free Delivery", code: "FASTFREE", sub: "Valid for first 3 orders" },
  { title: "Midnight Cravings", code: "NIGHT20", sub: "20% OFF after 10PM" },
];

const OfferBanners = () => {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {offers.map((offer) => (
        <article
          key={offer.code}
          className="group rounded-2xl border border-orange-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
        >
          <p className="text-lg font-black text-slate-900 dark:text-slate-100">{offer.title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{offer.sub}</p>
          <span className="mt-3 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white dark:bg-rose-500">{offer.code}</span>
        </article>
      ))}
    </section>
  );
};

export default OfferBanners;
