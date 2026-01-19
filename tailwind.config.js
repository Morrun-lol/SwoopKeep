/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}"
  ],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [],
};
