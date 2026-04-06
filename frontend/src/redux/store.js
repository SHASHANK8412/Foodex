import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer from "./slices/cartSlice";
import restaurantReducer from "./slices/restaurantSlice";
import orderReducer from "./slices/orderSlice";
import adminReducer from "./slices/adminSlice";
import analyticsReducer from "./slices/analyticsSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    restaurants: restaurantReducer,
    orders: orderReducer,
    admin: adminReducer,
    analytics: analyticsReducer,
  },
});

export default store;
