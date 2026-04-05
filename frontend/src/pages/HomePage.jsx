import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-orange-100 bg-white px-6 py-10 shadow-xl sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-orange-200/60 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-56 w-56 rounded-full bg-rose-200/60 blur-2xl" />
        <div className="relative max-w-3xl space-y-6">
          <p className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-rose-700">
            Food delivery reimagined
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-6xl">
            Cravings delivered with speed, style, and live tracking.
          </h1>
          <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
            Discover top restaurants, build your cart, checkout in seconds, and track every movement of your order from kitchen to doorstep.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/restaurants" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-700">
              Explore restaurants
            </Link>
            <Link to="/orders/track" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-slate-500">
              Track order
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Curated restaurants", text: "Handpicked kitchens and cloud brands with quality menus." },
          { title: "Fast checkout", text: "One-flow checkout with secure payment and confirmations." },
          { title: "Live map-like updates", text: "Instant order status updates and delivery location pings." },
        ].map((item) => (
          <article key={item.title} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default HomePage;
