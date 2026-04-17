import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "#07111f",
        },
        brand: {
          50: "#eef5ff",
          100: "#d7e7ff",
          200: "#b8d4ff",
          300: "#8ab8ff",
          400: "#568fff",
          500: "#2e67f6",
          600: "#1c4fd6",
          700: "#1b41ad",
          800: "#1d3a8a",
          900: "#1d356d",
        },
        success: "#0f766e",
        warning: "#c98a04",
        danger: "#c0362c",
      },
      boxShadow: {
        soft: "0 18px 40px -24px rgba(7, 17, 31, 0.35)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
