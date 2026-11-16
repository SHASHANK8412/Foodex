import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../services/api";
import { addToCart } from "../redux/slices/cartSlice";
import { addToast } from "../redux/slices/uiSlice";
import { formatCurrency } from "../utils/format";

// Suggestions for the cart, from GET /api/analytics/frequently-bought-together.
// They come from the Spark FP-Growth basket rules when the batch job has run,
// otherwise from what past orders at this restaurant contained.
const FrequentlyBoughtTogether = ({ items }) => {
  const dispatch = useDispatch();
  const [result, setResult] = useState({ source: "none", suggestions: [] });

  const restaurantId = items[0]?.restaurantId;
  const menuItemIds = items.map((item) => item.menuItemId).sort().join(",");

  useEffect(() => {
    if (!restaurantId || !menuItemIds) {
      return undefined;
    }

    let cancelled = false;
    api
      .get("/analytics/frequently-bought-together", { params: { restaurantId, menuItemIds, limit: 3 } })
      .then((response) => {
        if (!cancelled) setResult(response.data.data);
      })
      .catch(() => {
        if (!cancelled) setResult({ source: "none", suggestions: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId, menuItemIds]);

  if (!result.suggestions.length) {
    return null;
  }

  const add = (suggestion) => {
    dispatch(
      addToCart({
        menuItemId: suggestion.menuItemId,
        restaurantId,
        name: suggestion.name,
        price: suggestion.price,
      })
    );
    dispatch(addToast({ type: "success", message: `${suggestion.name} added to cart` }));
  };

  const explain = (suggestion) => {
    if (result.source === "spark_fp_growth") {
      return `${Math.round(suggestion.confidence * 100)}% of orders with ${suggestion.because.join(" + ")} include it`;
    }
    return `In ${Math.round(suggestion.confidence * 100)}% of past orders with your items`;
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Frequently ordered together</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {result.source === "spark_fp_growth" ? "From Spark FP-Growth basket analysis" : "From past orders"}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {result.suggestions.map((suggestion) => (
          <li key={suggestion.menuItemId} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{suggestion.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatCurrency(suggestion.price)} · {explain(suggestion)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => add(suggestion)}
              className="shrink-0 rounded-full border border-orange-300 bg-orange-50 px-4 py-1.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 dark:border-slate-600 dark:bg-slate-800 dark:text-orange-300"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FrequentlyBoughtTogether;
