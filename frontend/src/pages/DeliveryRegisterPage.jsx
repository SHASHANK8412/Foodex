import RoleRegisterPage from "./RoleRegisterPage";

const DeliveryRegisterPage = () => {
  return (
    <RoleRegisterPage
      title="Delivery partner registration"
      subtitle="Create your delivery partner account to receive assigned orders."
      role="delivery"
      loginTo="/delivery/login"
    />
  );
};

export default DeliveryRegisterPage;
