import { createSlice } from "@reduxjs/toolkit";

const savedTheme = localStorage.getItem("foodex_theme");

const initialState = {
  mode: savedTheme === "dark" ? "dark" : "light",
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === "dark" ? "light" : "dark";
      localStorage.setItem("foodex_theme", state.mode);
    },
    setTheme(state, action) {
      state.mode = action.payload === "dark" ? "dark" : "light";
      localStorage.setItem("foodex_theme", state.mode);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;

export default themeSlice.reducer;
