import RoleRegisterPage from "./RoleRegisterPage";

const RestaurantRegisterPage = () => {
  return (
    <RoleRegisterPage
      title="Restaurant partner registration"
      subtitle="Create your restaurant partner account to manage menus and incoming orders."
      role="restaurant"
      loginTo="/restaurant/login"
    />
  );
};

export default RestaurantRegisterPage;
