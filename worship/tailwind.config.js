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
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

