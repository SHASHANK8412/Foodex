import { ORDER_STATUS_LABELS, ORDER_TIMELINE } from "../utils/constants";

const OrderStatusTimeline = ({ status = "pending" }) => {
  const currentIndex = ORDER_TIMELINE.indexOf(status);

  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {ORDER_TIMELINE.map((step, index) => {
        const active = index <= currentIndex;
        return (
          <li key={step} className="flex items-center gap-2 sm:flex-col sm:items-start">
            <span
              className={
                "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black " +
                (active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-300")
              }
            >
              {index + 1}
            </span>
            <span className={"text-xs font-semibold uppercase tracking-wide " + (active ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400")}>
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderStatusTimeline;
