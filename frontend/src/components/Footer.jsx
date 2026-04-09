const Footer = () => {
  return (
    <footer className="mt-20 border-t border-orange-100 bg-white/70">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:px-6 lg:px-8">
        <div>
          <p className="font-bold text-slate-800">Foodex</p>
          <p>Fast delivery with live tracking and secure checkout.</p>
        </div>
        <p>Ordering made smarter with real-time tracking and predictions.</p>
      </div>
    </footer>
  );
};

export default Footer;
