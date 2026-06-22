/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'neu-flat': '8px 8px 16px #c9cacd, -8px -8px 16px #ffffff',
        'neu-pressed': 'inset 4px 4px 8px #c9cacd, inset -4px -4px 8px #ffffff'
      }
    },
  },
  plugins: [],
};