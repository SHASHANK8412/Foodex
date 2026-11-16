import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const initialState = {
  recommendations: [],
  demandForecast: null,
  deliveryEstimate: null,
  loading: false,
  error: "",
};

export const fetchRecommendations = createAsyncThunk("analytics/fetchRecommendations", async () => {
  const response = await api.get("/analytics/recommendations");
  return response.data.data;
});

export const fetchDemandForecast = createAsyncThunk("analytics/fetchDemandForecast", async (restaurantId) => {
  const response = await api.get("/analytics/demand/" + restaurantId);
  return response.data.data;
});

export const fetchDeliveryEstimate = createAsyncThunk("analytics/fetchDeliveryEstimate", async (params) => {
  const response = await api.get("/analytics/delivery-estimate", { params });
  return response.data.data;
});

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {
    clearAnalyticsError(state) {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        state.recommendations = action.payload;
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch recommendations";
      })
      .addCase(fetchDemandForecast.fulfilled, (state, action) => {
        state.demandForecast = action.payload;
      })
      .addCase(fetchDemandForecast.rejected, (state, action) => {
        state.error = action.error.message || "Failed to fetch demand forecast";
      })
      .addCase(fetchDeliveryEstimate.fulfilled, (state, action) => {
        state.deliveryEstimate = action.payload;
      })
      .addCase(fetchDeliveryEstimate.rejected, (state, action) => {
        state.error = action.error.message || "Failed to fetch delivery estimate";
      });
  },
});

export const { clearAnalyticsError } = analyticsSlice.actions;

export default analyticsSlice.reducer;
