/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marca: {
          50: "#eefbf4", 100: "#d6f5e3", 200: "#b0eacb", 500: "#1f9d61",
          600: "#147f4d", 700: "#11653f", 800: "#105034", 900: "#0d422c",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
