import { createSlice } from "@reduxjs/toolkit";

const savedCart = localStorage.getItem("foodex_cart");

const initialState = {
  items: savedCart ? JSON.parse(savedCart) : [],
};

const persistCart = (items) => {
  localStorage.setItem("foodex_cart", JSON.stringify(items));
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart(state, action) {
      const item = action.payload;

      if (state.items.length && state.items[0].restaurantId !== item.restaurantId) {
        state.items = [];
      }

      const existing = state.items.find((cartItem) => cartItem.menuItemId === item.menuItemId);

      if (existing) {
        existing.quantity += 1;
      } else {
        state.items.push({ ...item, quantity: 1 });
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
      persistCart([]);
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart } = cartSlice.actions;

export default cartSlice.reducer;
