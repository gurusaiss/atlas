/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        atlas: {
          bg: "#0f1117",
          panel: "#161922",
          border: "#242836",
          accent: "#6366f1",
          accentHover: "#818cf8",
          success: "#10b981",
          critical: "#ef4444",
          warning: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
