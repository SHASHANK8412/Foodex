import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthError, loginUser, loginWithGoogle, logout } from "../redux/slices/authSlice";
import GoogleLoginButton from "../components/GoogleLoginButton";

const defaultRedirectByRole = {
  admin: "/admin",
  delivery: "/delivery",
  restaurant: "/restaurant",
  user: "/",
};

const RoleLoginPage = ({
  title,
  subtitle,
  allowedRoles,
  loginPathHint,
  showGoogle = false,
  showRegisterLink = false,
  registerTo = "/register",
  showRoleLinks = true,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, user } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ email: "", password: "" });
  const [roleError, setRoleError] = useState("");

  const allowedRolesSet = useMemo(() => new Set(allowedRoles), [allowedRoles]);

  useEffect(() => {
    dispatch(clearAuthError());
    setRoleError("");
  }, [dispatch]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!allowedRolesSet.has(user.role)) {
      dispatch(logout());
      setRoleError(
        loginPathHint
          ? `This account is not allowed here. Please use ${loginPathHint}.`
          : "This account is not allowed here."
      );
      return;
    }

    const redirectTo = location.state?.from || defaultRedirectByRole[user.role] || "/";
    navigate(redirectTo, { replace: true });
  }, [user, allowedRolesSet, dispatch, navigate, location.state, loginPathHint]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await dispatch(loginUser(form));
  };

  const handleGoogleLogin = async (idToken) => {
    await dispatch(loginWithGoogle({ idToken }));
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
        />

        {(roleError || error) && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{roleError || error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      {showGoogle && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            Or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleLoginButton onCredential={handleGoogleLogin} disabled={loading} />
        </>
      )}

      {showRegisterLink && (
        <p className="mt-5 text-sm text-slate-600">
          New here?{" "}
          <Link to={registerTo} className="font-bold text-rose-600 hover:underline">
            Create account
          </Link>
        </p>
      )}

      {showRoleLinks && (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Other logins</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link to="/login" className="font-bold text-rose-600 hover:underline">
              User
            </Link>
            <Link to="/restaurant/login" className="font-bold text-rose-600 hover:underline">
              Restaurant
            </Link>
            <Link to="/delivery/login" className="font-bold text-rose-600 hover:underline">
              Delivery
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleLoginPage;
