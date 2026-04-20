import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { fetchMe } from "../redux/slices/authSlice";
import ToastContainer from "./ToastContainer";
import FloatingAIChatWidget from "./FloatingAIChatWidget";
import InstallPrompt from "./InstallPrompt";
import QuickCommandPalette from "./QuickCommandPalette";

const Layout = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const mode = useSelector((state) => state.theme.mode);

  useEffect(() => {
    if (token) {
      dispatch(fetchMe());
    }
  }, [token, dispatch]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="bg-[radial-gradient(circle_at_10%_20%,rgba(244,63,94,0.14),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.16),transparent_30%),linear-gradient(180deg,#fff7ed_0%,#f8fafc_45%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_10%_20%,rgba(190,24,93,0.2),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(249,115,22,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#020617_100%)]">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <Footer />
        <ToastContainer />
        <FloatingAIChatWidget />
        <InstallPrompt />
        <QuickCommandPalette />
      </div>
    </div>
  );
};

export default Layout;
