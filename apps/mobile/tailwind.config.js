/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#3b82f6', // Adjust based on your theme
        },
        navy: '#1e293b'
      }
    },
  },
  plugins: [],
};
