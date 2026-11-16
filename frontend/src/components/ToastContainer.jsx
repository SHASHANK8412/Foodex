import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { removeToast } from "../redux/slices/uiSlice";

const ToastContainer = () => {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.ui.toasts);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        dispatch(removeToast(toast.id));
      }, 2600)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dispatch]);

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            "rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur transition " +
            (toast.type === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-700"
              : toast.type === "error"
                ? "border-rose-200 bg-rose-50/95 text-rose-700"
                : "border-slate-200 bg-white/95 text-slate-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200")
          }
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
