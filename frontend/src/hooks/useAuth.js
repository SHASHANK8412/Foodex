import { useSelector } from "react-redux";

const useAuth = () => {
  const { user, token } = useSelector((state) => state.auth);

  return {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isAdmin: user?.role === "admin",
    isDelivery: user?.role === "delivery",
    isRestaurant: user?.role === "restaurant",
  };
};

export default useAuth;
