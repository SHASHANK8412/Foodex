import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { semanticSearchAi } from "../redux/slices/aiSlice";
import { addToCart } from "../redux/slices/cartSlice";

const SemanticSearchPanel = ({ restaurantId }) => {
  const dispatch = useDispatch();
  const { semanticResults, loading } = useSelector((state) => state.ai);
  const [query, setQuery] = useState("");

  const runSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    dispatch(semanticSearchAi({ query: query.trim(), restaurantId }));
  };

  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Semantic food search</h2>
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="comfort food for rainy day"
          className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Search
        </button>
      </form>

      {loading && <p className="text-sm text-slate-500">Searching semantically...</p>}

      {!!semanticResults.length && (
        <div className="grid gap-2 sm:grid-cols-2">
          {semanticResults.slice(0, 6).map((item) => (
            <article key={item._id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.restaurant?.name || "Kitchen"}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Rs.{item.price}</span>
                <button
                  type="button"
                  onClick={() =>
                    dispatch(
                      addToCart({
                        menuItemId: item._id,
                        restaurantId: item.restaurant?._id || item.restaurant,
                        name: item.name,
                        price: item.price,
                        quantity: 1,
                      })
                    )
                  }
                  className="rounded-full border border-orange-300 px-3 py-1 text-xs font-bold text-orange-700"
                >
                  Add
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default SemanticSearchPanel;
