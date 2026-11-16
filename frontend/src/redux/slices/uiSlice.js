import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  searchQuery: "",
  toasts: [],
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    addToast(state, action) {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      state.toasts.push({
        id,
        type: action.payload?.type || "info",
        message: action.payload?.message || "Notification",
      });
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { setSearchQuery, addToast, removeToast } = uiSlice.actions;

export default uiSlice.reducer;
