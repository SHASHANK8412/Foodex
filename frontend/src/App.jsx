import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import RestaurantsPage from "./pages/RestaurantsPage";
import RestaurantMenuPage from "./pages/RestaurantMenuPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import DeliveryDashboardPage from "./pages/DeliveryDashboardPage";
import RestaurantDashboardPage from "./pages/RestaurantDashboardPage";
import MenuDashboardPage from "./pages/MenuDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route path="restaurants/:restaurantId" element={<RestaurantMenuPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route
          path="checkout"
          element={
            <ProtectedRoute roles={["user", "admin"]}>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/track"
          element={
            <ProtectedRoute roles={["user", "admin", "delivery"]}>
              <OrderTrackingPage />
            </ProtectedRoute>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/analytics"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="restaurant-dashboard"
          element={
            <ProtectedRoute roles={["owner", "admin"]}>
              <RestaurantDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="restaurant/:restaurantId/menu"
          element={
            <ProtectedRoute roles={["owner", "admin"]}>
              <MenuDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="delivery"
          element={
            <ProtectedRoute roles={["delivery"]}>
              <DeliveryDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
