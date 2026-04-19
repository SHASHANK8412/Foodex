import LandingSection from "./LandingSection";
import Reveal from "../Reveal";

const dishes = [
  {
    name: "Saffron Butter Chicken",
    note: "Velvety, aromatic, indulgent",
    price: "from ₹329",
    accent: "from-roast-500/25 via-cream-50 to-gold-200/25",
  },
  {
    name: "Truffle Mushroom Pizza",
    note: "Crisp base, luxe finish",
    price: "from ₹399",
    accent: "from-slate-200/55 via-cream-50 to-amber-100/45",
  },
  {
    name: "Spicy Ramen Bowl",
    note: "Deep broth, clean heat",
    price: "from ₹289",
    accent: "from-spice-300/25 via-cream-50 to-sky-100/55",
  },
  {
    name: "Citrus Avocado Salad",
    note: "Fresh crunch, bright taste",
    price: "from ₹249",
    accent: "from-leaf-500/18 via-cream-50 to-emerald-100/55",
  },
  {
    name: "Roasted Orange Tacos",
    note: "Smoky, bold, addictive",
    price: "from ₹269",
    accent: "from-roast-400/22 via-cream-50 to-spice-100/40",
  },
  {
    name: "Soft Gold Cheesecake",
    note: "Silky bite, sweet glow",
    price: "from ₹219",
    accent: "from-gold-200/35 via-cream-50 to-amber-100/55",
  },
];

const DishCard = ({ dish }) => {
  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-orange-100/70 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lift dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className={"pointer-events-none absolute inset-0 bg-gradient-to-br " + dish.accent} />
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
      <div className="relative space-y-3">
        <p className="text-lg font-black text-slate-900 dark:text-slate-50">{dish.name}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{dish.note}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-50">{dish.price}</span>
          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-900/80 dark:text-slate-50/80">
            View
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </article>
  );
};

const BestSellingDishes = () => {
  return (
    <LandingSection
      id="dishes"
      kicker="Best-Selling"
      title="Signature dishes worth the obsession"
      subtitle="These are the kinds of dishes people screenshot, then order again."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dishes.map((dish, idx) => (
          <Reveal key={dish.name} delayMs={60 + idx * 50}>
            <DishCard dish={dish} />
          </Reveal>
        ))}
      </div>
    </LandingSection>
  );
};

export default BestSellingDishes;
