import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthError, registerUser } from "../redux/slices/authSlice";

const defaultRedirectByRole = {
  admin: "/admin",
  delivery: "/delivery",
  restaurant: "/restaurant",
  user: "/",
};

const RoleRegisterPage = ({ title, subtitle, role, loginTo }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, user } = useSelector((state) => state.auth);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
  });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const redirectTo = location.state?.from || defaultRedirectByRole[user.role] || "/";
    navigate(redirectTo, { replace: true });
  }, [user, navigate, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      role,
    };

    if (role === "user") {
      payload.address = {
        line1: form.addressLine1,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
      };
    }

    await dispatch(registerUser(payload));
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <input
          required
          placeholder="Full name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
        />
        <input
          placeholder="Phone number"
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
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

        {role === "user" && (
          <>
            <div className="pt-2">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Address</p>
            </div>
            <input
              required
              placeholder="Address line"
              value={form.addressLine1}
              onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                required
                placeholder="City"
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
              />
              <input
                required
                placeholder="State"
                value={form.state}
                onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
              />
              <input
                required
                placeholder="Postal code"
                value={form.postalCode}
                onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
              />
            </div>
          </>
        )}

        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Register"}
        </button>
      </form>

      <p className="mt-5 text-sm text-slate-600">
        Already registered?{" "}
        <Link to={loginTo} className="font-bold text-rose-600 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
};

export default RoleRegisterPage;
