import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { semanticSearchAi } from "../redux/slices/aiSlice";
import { addToCart } from "../redux/slices/cartSlice";
import { track } from "../services/tracker";

const EXAMPLES = ["comfort food for a rainy day", "something sweet after dinner", "light and healthy lunch", "crispy fried snack"];

// The score is cosine similarity from all-MiniLM-L6-v2 plus a small bonus
// for exact words, so it reads best as a rough strength, not a percentage.
const matchLabel = (item) => {
  if (item.matchedBy === "keyword") return { text: "Keyword match", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
  if (item.score >= 0.55) return { text: "Strong match", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
  if (item.score >= 0.4) return { text: "Good match", tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" };
  return { text: "Related", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
};

const SemanticSearchPanel = ({ restaurantId }) => {
  const dispatch = useDispatch();
  const { semanticResults, loading, error } = useSelector((state) => state.ai);
  const [query, setQuery] = useState("");
  // Results live in the shared store; only show them once this panel has searched.
  const [searched, setSearched] = useState("");

  const search = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSearched(trimmed);
    track("search", { query: trimmed, restaurantId });
    dispatch(semanticSearchAi({ query: trimmed, restaurantId }));
  };

  const results = searched ? semanticResults.slice(0, 6) : [];

  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Search by craving</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Describe what you feel like eating. Dishes are matched by meaning, not just by name.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          search(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="comfort food for a rainy day"
          aria-label="Describe what you feel like eating"
          className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button type="submit" disabled={loading} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 dark:bg-orange-600">
          Search
        </button>
      </form>

      {!searched && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => search(example)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-orange-300 hover:text-orange-700 dark:border-slate-700 dark:text-slate-300"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {loading && searched && <p className="text-sm text-slate-500">Finding dishes that match "{searched}"...</p>}

      {!loading && searched && error && <p className="text-sm text-rose-600">Search isn't available right now. Please try again.</p>}

      {!loading && searched && !error && !results.length && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing on the menu is close to "{searched}". Try describing a taste, a meal or an occasion.
        </p>
      )}

      {!loading && !!results.length && (
        <div className="grid gap-2 sm:grid-cols-2">
          {results.map((item) => {
            const label = matchLabel(item);
            const { price } = item; // what the server charges
            return (
              <article key={item._id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    <span
                      className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border ${item.isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500"}`}
                      title={item.isVeg ? "Vegetarian" : "Non-vegetarian"}
                    />
                    {item.name}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${label.tone}`}>{label.text}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.restaurant?.name || "Kitchen"}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{price}</span>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch(
                        addToCart({
                          menuItemId: item._id,
                          restaurantId: item.restaurant?._id || item.restaurant,
                          name: item.name,
                          price,
                          quantity: 1,
                        })
                      )
                    }
                    className="rounded-full border border-orange-300 px-3 py-1 text-xs font-bold text-orange-700 dark:text-orange-300"
                  >
                    Add
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SemanticSearchPanel;
