/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F8F7F4",
        card: "#FFFFFF",
        border: "#E4E2DC",
        "primary-text": "#1C1917",
        "muted-text": "#6B6560",
        accent: "#3D5A80",
        excellent: { bg: "#F0FDF4", text: "#166534" },
        good: { bg: "#DCFCE7", text: "#15803D" },
        moderate: { bg: "#FEFCE8", text: "#854D0E" },
        stressed: { bg: "#FFF7ED", text: "#9A3412" },
        critical: { bg: "#FFF1F2", text: "#9F1239" },
      },
      fontFamily: { sans: ["Inter", "sans-serif"] },
    },
  },
  plugins: [],
}
