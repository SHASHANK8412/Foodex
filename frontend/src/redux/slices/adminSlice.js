import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const initialState = {
  partners: [],
  loading: false,
  error: "",
};

export const fetchDeliveryPartners = createAsyncThunk("admin/fetchDeliveryPartners", async () => {
  const response = await api.get("/delivery/partners");
  return response.data.data;
});

export const createDeliveryPartner = createAsyncThunk("admin/createDeliveryPartner", async (payload) => {
  const response = await api.post("/delivery/partners", payload);
  return response.data.data;
});

export const assignDeliveryPartner = createAsyncThunk("admin/assignDeliveryPartner", async ({ orderId, deliveryPartnerId }) => {
  const response = await api.patch("/orders/" + orderId + "/assign-delivery", { deliveryPartnerId });
  return response.data.data;
});

export const updateOrderStatus = createAsyncThunk("admin/updateOrderStatus", async ({ orderId, status, note, location }) => {
  const response = await api.patch("/orders/" + orderId + "/status", {
    status,
    note,
    location,
  });

  return response.data.data;
});

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeliveryPartners.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDeliveryPartners.fulfilled, (state, action) => {
        state.loading = false;
        state.partners = action.payload;
      })
      .addCase(fetchDeliveryPartners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch delivery partners";
      })
      .addCase(createDeliveryPartner.fulfilled, (state, action) => {
        state.partners.push(action.payload);
      })
      .addCase(createDeliveryPartner.rejected, (state, action) => {
        state.error = action.error.message || "Failed to create delivery partner";
      })
      .addCase(assignDeliveryPartner.rejected, (state, action) => {
        state.error = action.error.message || "Failed to assign delivery partner";
      })
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.error = action.error.message || "Failed to update order status";
      });
  },
});

export const { clearAdminError } = adminSlice.actions;

export default adminSlice.reducer;
