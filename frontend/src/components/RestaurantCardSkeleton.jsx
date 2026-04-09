const RestaurantCardSkeleton = () => {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
};

export default RestaurantCardSkeleton;
