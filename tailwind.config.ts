import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12141C",
        paper: "#FFFFFF",
        mist: "#F6F7F5",
        line: "#E6E8E3",
        route: {
          DEFAULT: "#0F7B6C",
          light: "#12A38E",
          dark: "#0B5C51",
          tint: "#E6F4F1",
        },
        amber: {
          DEFAULT: "#D98E28",
          tint: "#FBF1DF",
        },
        danger: {
          DEFAULT: "#C4433B",
          tint: "#FBEBEA",
        },
      },
      fontFamily: {
        display: ["var(--font-manrope)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,20,28,0.04), 0 8px 24px -8px rgba(18,20,28,0.08)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.2,0.6,0.4,1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;
