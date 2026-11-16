import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../redux/slices/themeSlice";

const DarkModeToggle = () => {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.theme.mode);

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 dark:border-slate-700 dark:text-slate-200"
      aria-label="Toggle dark mode"
    >
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
};

export default DarkModeToggle;
