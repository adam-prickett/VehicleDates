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
      keyframes: {
        // Each dash is w-10 (40px) + mx-4 (8px×2 = 16px) = 56px per unit.
        // Animate exactly 20 units = 1120px for a seamless loop.
        "road-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-1120px)" },
        },
        "car-bob": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "speed-line": {
          "0%, 100%": { opacity: "0.6", transform: "scaleX(1)" },
          "50%": { opacity: "0.15", transform: "scaleX(0.4)" },
        },
      },
      animation: {
        "road-scroll": "road-scroll 5s linear infinite",
        "car-bob": "car-bob 0.35s ease-in-out infinite",
        "speed-line": "speed-line 0.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
