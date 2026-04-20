import RoleLoginPage from "./RoleLoginPage";

const LoginPage = () => {
  return (
    <RoleLoginPage
      title="Welcome back"
      subtitle="Login to continue your orders."
      allowedRoles={["user", "admin"]}
      loginPathHint="/login"
      showGoogle
      showRegisterLink
    />
  );
};

export default LoginPage;
