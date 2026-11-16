import { createSlice } from "@reduxjs/toolkit";

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the cart still works for this page view.
  }
};

const initialState = {
  items: readStored("foodex_cart", []),
  // The code the customer entered; the server decides whether it applies.
  couponCode: readStored("foodex_coupon", ""),
};

const persistCart = (items) => writeStored("foodex_cart", items);
const persistCoupon = (code) => writeStored("foodex_coupon", code);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart(state, action) {
      const item = action.payload;
      const quantityToAdd = Number(item.quantity || 1);

      if (state.items.length && state.items[0].restaurantId !== item.restaurantId) {
        state.items = [];
        state.couponCode = "";
        persistCoupon("");
      }

      const existing = state.items.find((cartItem) => cartItem.menuItemId === item.menuItemId);

      if (existing) {
        existing.quantity += quantityToAdd;
      } else {
        state.items.push({ ...item, quantity: Math.max(1, quantityToAdd) });
      }

      persistCart(state.items);
    },
    updateQuantity(state, action) {
      const { menuItemId, quantity } = action.payload;
      const existing = state.items.find((item) => item.menuItemId === menuItemId);
      if (!existing) {
        return;
      }

      existing.quantity = Math.max(1, quantity);
      persistCart(state.items);
    },
    removeFromCart(state, action) {
      state.items = state.items.filter((item) => item.menuItemId !== action.payload);
      persistCart(state.items);
    },
    clearCart(state) {
      state.items = [];
      state.couponCode = "";
      persistCart([]);
      persistCoupon("");
    },
    setCouponCode(state, action) {
      state.couponCode = String(action.payload || "").trim().toUpperCase();
      persistCoupon(state.couponCode);
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart, setCouponCode } = cartSlice.actions;

export default cartSlice.reducer;
