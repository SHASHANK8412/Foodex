import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthError, loginUser, loginWithGoogle } from "../redux/slices/authSlice";
import GoogleLoginButton from "../components/GoogleLoginButton";

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, user } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      const redirectTo = location.state?.from || "/";
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await dispatch(loginUser(form));
  };

  const handleGoogleLogin = async (idToken) => {
    await dispatch(loginWithGoogle({ idToken }));
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-black tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">Login to continue your orders.</p>

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

        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        Or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <GoogleLoginButton onCredential={handleGoogleLogin} disabled={loading} />

      <p className="mt-5 text-sm text-slate-600">
        New here?{" "}
        <Link to="/register" className="font-bold text-rose-600 hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
