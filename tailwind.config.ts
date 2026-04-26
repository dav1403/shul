import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#fdf8f0",
          100: "#faefd9",
          200: "#f4dab3",
          300: "#ecc07e",
          400: "#e4a247",
          500: "#dc8a20",
          600: "#c47016",
          700: "#a35614",
          800: "#844418",
          900: "#6b3817",
        },
        slate: {
          850: "#1a2234",
        },
      },
    },
  },
  plugins: [],
};

export default config;
