import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const initialState = {
  restaurants: [],
  selectedRestaurant: null,
  demandByRestaurant: {},
  loading: false,
  error: "",
};

export const fetchRestaurants = createAsyncThunk("restaurants/fetchRestaurants", async () => {
  const response = await api.get("/restaurants");
  return response.data.data;
});

export const fetchRestaurantById = createAsyncThunk("restaurants/fetchRestaurantById", async (restaurantId) => {
  const response = await api.get("/restaurants/" + restaurantId);
  return response.data.data;
});

const restaurantSlice = createSlice({
  name: "restaurants",
  initialState,
  reducers: {
    applyDemandUpdate(state, action) {
      const update = action.payload;
      if (!update?.restaurantId) {
        return;
      }

      state.demandByRestaurant[update.restaurantId] = update;

      state.restaurants = state.restaurants.map((restaurant) =>
        restaurant._id === update.restaurantId
          ? {
              ...restaurant,
              demandLevel: update.demandLevel,
              activeOrders: update.activeOrders,
              estimatedWaitMinutes: update.estimatedWaitMinutes,
            }
          : restaurant
      );

      if (state.selectedRestaurant?.restaurant?._id === update.restaurantId) {
        state.selectedRestaurant.restaurant = {
          ...state.selectedRestaurant.restaurant,
          demandLevel: update.demandLevel,
          activeOrders: update.activeOrders,
          estimatedWaitMinutes: update.estimatedWaitMinutes,
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRestaurants.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.loading = false;
        state.restaurants = action.payload;
      })
      .addCase(fetchRestaurants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch restaurants";
      })
      .addCase(fetchRestaurantById.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchRestaurantById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedRestaurant = action.payload;
      })
      .addCase(fetchRestaurantById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch menu";
      });
  },
});

export const { applyDemandUpdate } = restaurantSlice.actions;

export default restaurantSlice.reducer;
