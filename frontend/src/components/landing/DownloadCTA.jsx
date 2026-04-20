import Reveal from "../Reveal";

const storeButtonClass =
  "inline-flex items-center gap-3 rounded-2xl border border-white/45 bg-white/15 px-4 py-3 text-left text-white shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const DownloadCTA = () => {
  return (
    <section id="download" className="premium-surface grain-overlay scroll-mt-28 px-6 py-10 sm:px-10">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr,0.9fr]">
        <Reveal className="space-y-4">
          <p className="section-kicker">App Download</p>
          <h2 className="text-3xl font-black leading-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
            Your cravings deserve a home screen icon.
          </h2>
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
            Save addresses, reorder instantly, and track your delivery in real-time — all wrapped in a warm, premium interface.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a href="#" className={storeButtonClass} aria-label="Download on the App Store">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20">
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M16.6 13.2c0-2 1.7-3 1.8-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.7-.8-2.7-.8-1.4 0-2.7.8-3.4 2-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.1 2.8 2 1.1 0 1.6-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.1.8-1.2 1.1-2.4 1.1-2.5-.1 0-2.1-.8-2.1-3.2ZM14.8 6.9c.6-.7 1-1.7.9-2.7-.9.1-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 0 2-.5 2.6-1.3Z"
                  />
                </svg>
              </span>
              <span>
                <span className="block text-[11px] font-bold text-white/80">Download on</span>
                <span className="block text-sm font-black">App Store</span>
              </span>
            </a>

            <a href="#" className={storeButtonClass} aria-label="Get it on Google Play">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20">
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3.6 2.9c-.3.3-.5.8-.5 1.4v15.4c0 .6.2 1.1.5 1.4l9-9-9-9Zm10.1 9.7 2.1-2.1-9.4-5.4 7.3 7.5Zm2.9-2.9 2.8-1.6c.8-.5.8-1.2 0-1.7l-2.8-1.6-2.4 2.4 2.4 2.5Zm-2.9 3.8-7.3 7.5 9.4-5.4-2.1-2.1Zm-.8-.9-2.4-2.4L4.8 20.6l8.1-8Z"
                  />
                </svg>
              </span>
              <span>
                <span className="block text-[11px] font-bold text-white/80">Get it on</span>
                <span className="block text-sm font-black">Google Play</span>
              </span>
            </a>
          </div>
        </Reveal>

        <Reveal delayMs={120}>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 text-white shadow-premium">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(250,204,21,0.25),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(244,63,94,0.25),transparent_50%),radial-gradient(circle_at_60%_85%,rgba(249,115,22,0.20),transparent_50%)]" />
            <div className="relative space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.26em] text-white/70">Perks</p>
              <ul className="space-y-3 text-sm font-semibold text-white/90">
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-gold-200" />
                  Saved addresses & 1-tap reorder
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-spice-300" />
                  Live tracking & delivery updates
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-roast-400" />
                  Personalized recommendations
                </li>
              </ul>
              <div className="pt-4">
                <a href="#" className="btn-primary w-full justify-center">
                  Get the app
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default DownloadCTA;
