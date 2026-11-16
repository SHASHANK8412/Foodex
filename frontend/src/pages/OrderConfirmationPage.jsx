import { Link, useSearchParams } from "react-router-dom";

const OrderConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Order Confirmed</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Your order has been placed successfully.
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          We have started preparing your food. Track progress in real time from kitchen to doorstep.
        </p>
        {!!orderId && (
          <div className="mt-4 inline-flex rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300">
            Order ID: {orderId.slice(-8)}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={orderId ? `/orders/track?orderId=${orderId}` : "/orders/track"}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700"
          >
            Track this order
          </Link>
          <Link
            to="/user-dashboard"
            className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </div>
  );
};

export default OrderConfirmationPage;
