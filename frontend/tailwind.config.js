/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#fffaf1",
          100: "#fff3de",
          200: "#ffe6b8",
        },
        spice: {
          50: "#fff1f3",
          100: "#ffe4e8",
          300: "#fda4af",
          500: "#f43f5e",
          700: "#be123c",
          900: "#881337",
        },
        saffron: {
          50: "#fffbeb",
          100: "#fef3c7",
          400: "#fbbf24",
          500: "#f59e0b",
          700: "#b45309",
        },
        roast: {
          50: "#fff7ed",
          100: "#ffedd5",
          400: "#fb923c",
          500: "#f97316",
          700: "#c2410c",
        },
        leaf: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#22c55e",
          700: "#15803d",
        },
        charcoal: {
          50: "#f8fafc",
          100: "#f1f5f9",
          700: "#1f2937",
          900: "#0b1220",
        },
        gold: {
          50: "#fffce8",
          200: "#fde68a",
          400: "#facc15",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        body: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        premium:
          "0 18px 60px rgba(15, 23, 42, 0.14), 0 8px 18px rgba(15, 23, 42, 0.10)",
        lift: "0 18px 40px rgba(15, 23, 42, 0.14)",
        glow: "0 0 0 1px rgba(244, 63, 94, 0.12), 0 18px 60px rgba(244, 63, 94, 0.12)",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0px) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        pop: {
          "0%": { transform: "scale(0.98)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        rise: "rise 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 6s ease-in-out infinite alternate",
        pop: "pop 260ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      backgroundImage: {
        "hero-sheen":
          "radial-gradient(1200px circle at 10% 12%, rgba(250,204,21,0.18), transparent 45%), radial-gradient(900px circle at 85% 10%, rgba(244,63,94,0.18), transparent 40%), radial-gradient(900px circle at 75% 90%, rgba(249,115,22,0.14), transparent 45%), linear-gradient(180deg, rgba(255,250,241,0.96) 0%, rgba(248,250,252,0.86) 45%, rgba(248,250,252,0.90) 100%)",
        "dark-sheen":
          "radial-gradient(1200px circle at 10% 12%, rgba(250,204,21,0.10), transparent 45%), radial-gradient(900px circle at 85% 10%, rgba(244,63,94,0.12), transparent 40%), radial-gradient(900px circle at 75% 90%, rgba(249,115,22,0.12), transparent 45%), linear-gradient(180deg, rgba(2,6,23,0.92) 0%, rgba(15,23,42,0.92) 55%, rgba(2,6,23,0.92) 100%)",
      },
    },
  },
  plugins: [],
};

