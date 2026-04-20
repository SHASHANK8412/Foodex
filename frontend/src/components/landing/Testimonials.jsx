import LandingSection from "./LandingSection";
import Reveal from "../Reveal";

const testimonials = [
  {
    name: "Aarav",
    title: "Weekend regular",
    quote:
      "Saturday nights are sorted. I pick a spot, add a couple of favourites, and the food shows up hot — no overthinking.",
  },
  {
    name: "Meera",
    title: "Late-night foodie",
    quote:
      "When cravings hit at 11pm, I can place an order in a minute and track it without stress. That’s the whole win for me.",
  },
  {
    name: "Kabir",
    title: "Busy professional",
    quote:
      "I mostly reorder during work breaks. It’s quick, the options feel relevant, and checkout doesn’t make me fight through steps.",
  },
];

const Stars = () => (
  <div className="flex items-center gap-1 text-amber-500">
    {Array.from({ length: 5 }).map((_, idx) => (
      <svg key={idx} viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9.99 1.5l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L9.99 1.5z"
        />
      </svg>
    ))}
  </div>
);

const TestimonialCard = ({ item }) => {
  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-orange-100/70 bg-white/75 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lift dark:border-slate-800/70 dark:bg-slate-950/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(250,204,21,0.16),transparent_50%),radial-gradient(circle_at_85%_30%,rgba(244,63,94,0.14),transparent_52%)]" />
      <div className="relative space-y-4">
        <Stars />
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">“{item.quote}”</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-slate-50">{item.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.title}</p>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-spice-500 to-orange-500 text-sm font-black text-white shadow-sm">
            {item.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </article>
  );
};

const Testimonials = () => {
  return (
    <LandingSection
      id="testimonials"
      kicker="Loved By Customers"
      title="People don’t just order — they come back"
      subtitle="Quick notes from people who actually use it." 
    >
      <div className="grid gap-4 md:grid-cols-3">
        {testimonials.map((item, idx) => (
          <Reveal key={item.name} delayMs={60 + idx * 60}>
            <TestimonialCard item={item} />
          </Reveal>
        ))}
      </div>
    </LandingSection>
  );
};

export default Testimonials;
