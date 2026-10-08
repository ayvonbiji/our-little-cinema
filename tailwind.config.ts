import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07060a",
          900: "#0d0b10",
          850: "#131016",
          800: "#1a161d",
          700: "#252028",
          600: "#3a3340",
        },
        wine: {
          300: "#f2a3ae",
          400: "#e06474",
          500: "#c53a4f",
          600: "#a1263b",
          700: "#7a1a2c",
          800: "#4f1120",
        },
        cream: "#f4ece4",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translate(-50%, 0) scale(0.6)", opacity: "0" },
          "12%": { transform: "translate(-50%, -20px) scale(1.05)", opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translate(-50%, -260px) scale(1)", opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        curtain: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0", visibility: "hidden" },
        },
        glow: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.6" },
        },
        pulseDot: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.35)", opacity: "0.6" },
        },
      },
      animation: {
        floatUp: "floatUp 3.2s ease-out forwards",
        fadeIn: "fadeIn 0.6s ease-out both",
        curtain: "curtain 1.4s ease-in-out 0.2s forwards",
        glow: "glow 8s ease-in-out infinite",
        pulseDot: "pulseDot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
