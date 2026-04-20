import RoleRegisterPage from "./RoleRegisterPage";

const RegisterPage = () => {
  return (
    <RoleRegisterPage
      title="Create account"
      subtitle="Join Foodex for faster checkout and tracking."
      role="user"
      loginTo="/login"
    />
  );
};

export default RegisterPage;
