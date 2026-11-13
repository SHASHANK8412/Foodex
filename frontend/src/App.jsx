import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

// Each page is its own chunk, loaded when first visited; the home page ships in
// the main bundle so the first screen needs one request.
const RestaurantsPage = lazy(() => import("./pages/RestaurantsPage"));
const RestaurantMenuPage = lazy(() => import("./pages/RestaurantMenuPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmationPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const AdminPaymentsPage = lazy(() => import("./pages/AdminPaymentsPage"));
const AdminPipelinePage = lazy(() => import("./pages/AdminPipelinePage"));
const DeliveryDashboardPage = lazy(() => import("./pages/DeliveryDashboardPage"));
const RestaurantDashboardPage = lazy(() => import("./pages/RestaurantDashboardPage"));
const MenuDashboardPage = lazy(() => import("./pages/MenuDashboardPage"));
const UserDashboardPage = lazy(() => import("./pages/UserDashboardPage"));
const GroupOrderPage = lazy(() => import("./pages/GroupOrderPage"));

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
        <Route
          path="order-confirmation"
          element={
            <ProtectedRoute roles={["user", "admin"]}>
              <OrderConfirmationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="user-dashboard"
          element={
            <ProtectedRoute roles={["user", "admin"]}>
              <UserDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="group-order/:inviteCode"
          element={
            <ProtectedRoute roles={["user", "admin"]}>
              <GroupOrderPage />
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
          path="admin/payments"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/pipeline"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPipelinePage />
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
