import { createSlice } from "@reduxjs/toolkit";

const saved = localStorage.getItem("foodex_wishlist");

const initialState = {
  restaurantIds: saved ? JSON.parse(saved) : [],
};

const persist = (restaurantIds) => {
  localStorage.setItem("foodex_wishlist", JSON.stringify(restaurantIds));
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    toggleFavoriteRestaurant(state, action) {
      const id = action.payload;
      if (state.restaurantIds.includes(id)) {
        state.restaurantIds = state.restaurantIds.filter((item) => item !== id);
      } else {
        state.restaurantIds.push(id);
      }
      persist(state.restaurantIds);
    },
  },
});

export const { toggleFavoriteRestaurant } = wishlistSlice.actions;

export default wishlistSlice.reducer;
