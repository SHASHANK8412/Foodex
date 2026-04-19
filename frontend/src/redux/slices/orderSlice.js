import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

const initialState = {
  orders: [],
  activeOrder: null,
  paymentMeta: null,
  loading: false,
  error: "",
};

export const createOrder = createAsyncThunk("orders/createOrder", async (payload) => {
  const response = await api.post("/orders", payload);
  return response.data.data;
});

export const verifyOrderPayment = createAsyncThunk("orders/verifyOrderPayment", async (payload) => {
  const response = await api.post("/orders/verify-payment", payload);
  return response.data.data;
});

export const fetchOrders = createAsyncThunk("orders/fetchOrders", async () => {
  const response = await api.get("/orders");
  return response.data.data;
});

export const fetchOrderById = createAsyncThunk("orders/fetchOrderById", async (orderId) => {
  const response = await api.get("/orders/" + orderId);
  return response.data.data;
});

const orderSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    setActiveOrderFromSocket(state, action) {
      const order = action.payload;
      state.activeOrder = order;
      const index = state.orders.findIndex((item) => item._id === order._id);
      if (index >= 0) {
        state.orders[index] = order;
      } else {
        state.orders.unshift(order);
      }
    },
    clearOrderState(state) {
      state.error = "";
      state.paymentMeta = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.activeOrder = action.payload.order;
        state.paymentMeta = action.payload.payment;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to create order";
      })
      .addCase(verifyOrderPayment.fulfilled, (state, action) => {
        state.activeOrder = action.payload;
      })
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch orders";
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.activeOrder = action.payload;
      });
  },
});

export const { setActiveOrderFromSocket, clearOrderState } = orderSlice.actions;

export default orderSlice.reducer;
