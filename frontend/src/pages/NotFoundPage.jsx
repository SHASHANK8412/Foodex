import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">404</p>
      <h1 className="mt-2 text-3xl font-black text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white">
        Back home
      </Link>
    </div>
  );
};

export default NotFoundPage;
