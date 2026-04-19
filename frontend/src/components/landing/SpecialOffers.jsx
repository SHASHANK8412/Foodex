import LandingSection from "./LandingSection";
import Reveal from "../Reveal";
import { useDispatch } from "react-redux";
import { addToast } from "../../redux/slices/uiSlice";

const offers = [
  {
    title: "Flat 30% off",
    code: "FOODEX30",
    note: "On orders above ₹499",
    accent: "from-spice-300/25 via-cream-50 to-orange-100/55",
  },
  {
    title: "Free delivery",
    code: "FASTFREE",
    note: "Valid for your first 3 orders",
    accent: "from-leaf-500/18 via-cream-50 to-emerald-100/55",
  },
  {
    title: "Midnight cravings",
    code: "NIGHT20",
    note: "20% off after 10PM",
    accent: "from-gold-200/35 via-cream-50 to-amber-100/55",
  },
];

const OfferCard = ({ offer, onCopy }) => {
  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-orange-100/70 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lift dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className={"pointer-events-none absolute inset-0 bg-gradient-to-br " + offer.accent} />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/35 blur-2xl" />
      <div className="relative space-y-3">
        <p className="text-xl font-black text-slate-900 dark:text-slate-50">{offer.title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{offer.note}</p>
        <button
          type="button"
          onClick={() => onCopy?.(offer.code)}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 dark:bg-rose-500 dark:hover:bg-rose-600"
          aria-label={"Copy offer code " + offer.code}
        >
          {offer.code}
          <span className="text-[10px] font-black tracking-[0.16em] text-white/75">COPY</span>
        </button>
      </div>
    </article>
  );
};

const SpecialOffers = () => {
  const dispatch = useDispatch();

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      dispatch(addToast({ type: "success", message: `Copied ${code}` }));
    } catch {
      dispatch(addToast({ type: "info", message: `Use code: ${code}` }));
    }
  };

  return (
    <LandingSection
      id="offers"
      kicker="Special Offers"
      title="Discounts that feel like a secret"
      subtitle="Premium promos that are easy to find, easy to use, and hard to resist."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer, idx) => (
          <Reveal key={offer.code} delayMs={60 + idx * 60}>
            <OfferCard offer={offer} onCopy={copyCode} />
          </Reveal>
        ))}
      </div>
    </LandingSection>
  );
};

export default SpecialOffers;
