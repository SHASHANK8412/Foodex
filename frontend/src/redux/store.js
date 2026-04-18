import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer from "./slices/cartSlice";
import restaurantReducer from "./slices/restaurantSlice";
import orderReducer from "./slices/orderSlice";
import adminReducer from "./slices/adminSlice";
import analyticsReducer from "./slices/analyticsSlice";
import themeReducer from "./slices/themeSlice";
import uiReducer from "./slices/uiSlice";
import wishlistReducer from "./slices/wishlistSlice";
import aiReducer from "./slices/aiSlice";
import menuReducer from "./slices/menuSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    restaurants: restaurantReducer,
    orders: orderReducer,
    admin: adminReducer,
    analytics: analyticsReducer,
    theme: themeReducer,
    ui: uiReducer,
    wishlist: wishlistReducer,
    ai: aiReducer,
    menu: menuReducer,
  },
});

export default store;
