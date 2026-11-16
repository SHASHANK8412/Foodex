import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const initialState = {
  dashboard: { restaurants: [], kpis: {}, topDishes: [] },
  orders: [],
  invoiceByOrder: {},
  loading: false,
  ordersLoading: false,
  actionLoading: false,
  error: "",
  notifications: [],
};

export const fetchPartnerDashboard = createAsyncThunk("partner/fetchDashboard", async () => {
  const response = await api.get("/owner/dashboard");
  return response.data.data;
});

export const fetchPartnerOrders = createAsyncThunk("partner/fetchOrders", async (params = {}) => {
  const response = await api.get("/owner/orders", { params });
  return response.data.data;
});

export const updatePartnerOrderStatus = createAsyncThunk(
  "partner/updateOrderStatus",
  async ({ orderId, status, note }) => {
    const response = await api.patch(`/owner/orders/${orderId}/status`, { status, note });
    return response.data.data;
  }
);

export const fetchPartnerInvoice = createAsyncThunk("partner/fetchInvoice", async (orderId) => {
  const response = await api.get(`/owner/orders/${orderId}/invoice`);
  return { orderId, invoice: response.data.data };
});

const partnerSlice = createSlice({
  name: "partner",
  initialState,
  reducers: {
    clearPartnerError(state) {
      state.error = "";
    },
    setRealtimeOrderUpdate(state, action) {
      const order = action.payload;
      if (!order?._id) {
        return;
      }

      const index = state.orders.findIndex((item) => item._id === order._id);
      if (index >= 0) {
        state.orders[index] = order;
      } else {
        state.orders.unshift(order);
      }

      state.notifications.unshift({
        id: `${Date.now()}-${order._id}`,
        title: "Order update",
        message: `Order ${order.shortId || order._id.slice(-6)} is ${order.status}`,
        createdAt: new Date().toISOString(),
      });

      state.notifications = state.notifications.slice(0, 30);
    },
    markPartnerNotificationRead(state, action) {
      const id = action.payload;
      state.notifications = state.notifications.filter((item) => item.id !== id);
    },
    clearPartnerNotifications(state) {
      state.notifications = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPartnerDashboard.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchPartnerDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchPartnerDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch dashboard";
      })
      .addCase(fetchPartnerOrders.pending, (state) => {
        state.ordersLoading = true;
      })
      .addCase(fetchPartnerOrders.fulfilled, (state, action) => {
        state.ordersLoading = false;
        state.orders = action.payload || [];
      })
      .addCase(fetchPartnerOrders.rejected, (state, action) => {
        state.ordersLoading = false;
        state.error = action.error.message || "Failed to fetch partner orders";
      })
      .addCase(updatePartnerOrderStatus.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(updatePartnerOrderStatus.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        const index = state.orders.findIndex((item) => item._id === updated._id);
        if (index >= 0) {
          state.orders[index] = updated;
        }
      })
      .addCase(updatePartnerOrderStatus.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.error.message || "Failed to update order status";
      })
      .addCase(fetchPartnerInvoice.fulfilled, (state, action) => {
        state.invoiceByOrder[action.payload.orderId] = action.payload.invoice;
      })
      .addCase(fetchPartnerInvoice.rejected, (state, action) => {
        state.error = action.error.message || "Failed to fetch invoice";
      });
  },
});

export const {
  clearPartnerError,
  setRealtimeOrderUpdate,
  markPartnerNotificationRead,
  clearPartnerNotifications,
} = partnerSlice.actions;

export default partnerSlice.reducer;
