/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Noto Sans JP", "Noto Sans CJK JP", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Noto Sans JP", "Noto Sans CJK JP", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
