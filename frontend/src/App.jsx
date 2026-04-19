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
import DeliveryLoginPage from "./pages/DeliveryLoginPage";
import RestaurantLoginPage from "./pages/RestaurantLoginPage";
import RegisterPage from "./pages/RegisterPage";
import DeliveryRegisterPage from "./pages/DeliveryRegisterPage";
import RestaurantRegisterPage from "./pages/RestaurantRegisterPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import DeliveryDashboardPage from "./pages/DeliveryDashboardPage";
import RestaurantDashboardPage from "./pages/RestaurantDashboardPage";
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
        <Route path="delivery/login" element={<DeliveryLoginPage />} />
        <Route path="restaurant/login" element={<RestaurantLoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="delivery/register" element={<DeliveryRegisterPage />} />
        <Route path="restaurant/register" element={<RestaurantRegisterPage />} />
        <Route
          path="delivery"
          element={
            <ProtectedRoute roles={["delivery"]} redirectTo="/delivery/login">
              <DeliveryDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="restaurant"
          element={
            <ProtectedRoute roles={["restaurant"]} redirectTo="/restaurant/login">
              <RestaurantDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboardPage />
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
