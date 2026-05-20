/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#0e6b3a',
        feltDark: '#0a4f2a',
      },
    },
  },
  plugins: [],
};
