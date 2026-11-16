import { formatDateTime } from "../../utils/format";

const PartnerReviewsPanel = ({ reviews, onRespond, responseDrafts, setResponseDrafts }) => {
  if (!reviews.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-300">No reviews available.</p>;
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => {
        const reviewId = review._id || review.id;
        const customerName = review.customerName || review.user?.name || "Customer";
        const responseText = review.ownerResponse?.text || review.response;

        return (
        <article key={reviewId} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{customerName}</p>
            <p className="text-xs text-amber-600">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>
          <p className="mt-1 text-xs text-slate-400">{formatDateTime(review.createdAt)}</p>

          {responseText ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              Owner response: {responseText}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={responseDrafts[reviewId] || ""}
                onChange={(event) =>
                  setResponseDrafts((prev) => ({
                    ...prev,
                    [reviewId]: event.target.value,
                  }))
                }
                placeholder="Write a response"
                className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => onRespond(reviewId, responseDrafts[reviewId] || "")}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
              >
                Respond
              </button>
            </div>
          )}
        </article>
      )})}
    </div>
  );
};

export default PartnerReviewsPanel;
