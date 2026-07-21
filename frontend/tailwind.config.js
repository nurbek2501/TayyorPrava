/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        bg2: "rgb(var(--bg-2) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        ink: "rgb(var(--text) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--border) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "rgb(var(--accent-2) / <alpha-value>)",
        },
        success: "#16A34A",
        danger: "#DC2626",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "16px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(2, 6, 23, 0.35)",
        glow: "0 0 0 1px rgba(37,99,235,0.4), 0 8px 30px rgba(37,99,235,0.25)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "zoom-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-danger": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.5)" },
          "50%": { boxShadow: "0 0 0 8px rgba(239,68,68,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-x": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(10px, -10px)" },
        },
        "blob-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30px, -20px) scale(1.08)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.95)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "fade-up": "fade-up 0.4s ease-out",
        "zoom-in": "zoom-in 0.2s ease-out",
        "pulse-danger": "pulse-danger 1s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        "float-x": "float-x 7s ease-in-out infinite",
        "blob-drift": "blob-drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
