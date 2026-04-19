import RoleLoginPage from "./RoleLoginPage";

const RestaurantLoginPage = () => {
  return (
    <RoleLoginPage
      title="Restaurant partner login"
      subtitle="Login to manage your restaurant and incoming orders."
      allowedRoles={["restaurant"]}
      loginPathHint="/restaurant/login"
      showRegisterLink
      registerTo="/restaurant/register"
      showRoleLinks={false}
    />
  );
};

export default RestaurantLoginPage;
