/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#1a0a2e',
        cosmic: '#2d1b69',
        nebula: '#4a2080',
        stardust: '#7c3aed',
        aurora: '#a78bfa',
        moonbeam: '#e2d9f3',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
