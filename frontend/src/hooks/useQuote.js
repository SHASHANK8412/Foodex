import { useEffect, useState } from "react";
import api from "../services/api";

const DEBOUNCE_MS = 250;

// Prices the cart on the server (POST /api/pricing/quote). The server reads item
// prices from the database and validates the coupon, so the bill shown here is
// exactly what the order will be charged.
const useQuote = (items, couponCode) => {
  const [state, setState] = useState({ quote: null, loading: false, error: "" });

  const restaurantId = items[0]?.restaurantId;
  const key = JSON.stringify(items.map((item) => [item.menuItemId, item.quantity]));

  useEffect(() => {
    if (!restaurantId) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((previous) => ({ ...previous, loading: true, error: "" }));
      try {
        const response = await api.post("/pricing/quote", {
          restaurantId,
          items: JSON.parse(key).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
          couponCode: couponCode || undefined,
        });
        if (!cancelled) {
          setState({ quote: response.data.data, loading: false, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ quote: null, loading: false, error: error.message });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [restaurantId, key, couponCode]);

  return restaurantId ? state : { quote: null, loading: false, error: "" };
};

export default useQuote;
