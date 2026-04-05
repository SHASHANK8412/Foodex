import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const token = localStorage.getItem("foodex_token");
const user = localStorage.getItem("foodex_user");

const initialState = {
  token: token || "",
  user: user ? JSON.parse(user) : null,
  loading: false,
  error: "",
};

export const registerUser = createAsyncThunk("auth/registerUser", async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data.data;
});

export const loginUser = createAsyncThunk("auth/loginUser", async (payload) => {
  const response = await api.post("/auth/login", payload);
  return response.data.data;
});

export const fetchMe = createAsyncThunk("auth/fetchMe", async () => {
  const response = await api.get("/auth/me");
  return response.data.data;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.token = "";
      state.user = null;
      localStorage.removeItem("foodex_token");
      localStorage.removeItem("foodex_user");
    },
    clearAuthError(state) {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem("foodex_token", action.payload.token);
        localStorage.setItem("foodex_user", JSON.stringify(action.payload.user));
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to register";
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem("foodex_token", action.payload.token);
        localStorage.setItem("foodex_user", JSON.stringify(action.payload.user));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to login";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        localStorage.setItem("foodex_user", JSON.stringify(action.payload));
      })
      .addCase(fetchMe.rejected, (state) => {
        state.token = "";
        state.user = null;
        localStorage.removeItem("foodex_token");
        localStorage.removeItem("foodex_user");
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;

export default authSlice.reducer;
