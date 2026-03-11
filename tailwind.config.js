/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/client/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "dvla-green": "#00703c",
        "dvla-yellow": "#ffdd00",
      },
    },
  },
  plugins: [],
};
