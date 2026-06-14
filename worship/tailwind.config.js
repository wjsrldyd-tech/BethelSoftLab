/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['나눔고딕', 'Nanum Gothic', 'Noto Sans KR', 'sans-serif'],
      },
      colors: {
        primary: {
          text: '#2C3E50',
          accent: '#34495E',
          focus: '#3498DB',
          border: '#BDC3C7',
        },
      },
    },
  },
  plugins: [],
}

