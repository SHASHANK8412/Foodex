import RoleLoginPage from "./RoleLoginPage";

const DeliveryLoginPage = () => {
  return (
    <RoleLoginPage
      title="Delivery partner login"
      subtitle="Login to manage your assigned deliveries."
      allowedRoles={["delivery"]}
      loginPathHint="/delivery/login"
      showGoogle
      showRegisterLink
      registerTo="/delivery/register"
      showRoleLinks={false}
    />
  );
};

export default DeliveryLoginPage;
