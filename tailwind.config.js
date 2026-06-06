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
        "backdrop-in": {
          "0%": {
            opacity: "0",
            backdropFilter: "blur(0px)",
            WebkitBackdropFilter: "blur(0px)",
          },
          "100%": {
            opacity: "1",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          },
        },
        "modal-slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "modal-fade-zoom": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "road-scroll": "road-scroll 5s linear infinite",
        "car-bob": "car-bob 0.35s ease-in-out infinite",
        "speed-line": "speed-line 0.5s ease-in-out infinite",
        "backdrop-in": "backdrop-in 220ms ease-out both",
        "modal-slide-up":
          "modal-slide-up 260ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "modal-fade-zoom": "modal-fade-zoom 180ms ease-out both",
      },
    },
  },
  plugins: [],
};
