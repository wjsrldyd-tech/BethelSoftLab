import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    open: true, // 개발 서버 시작 시 자동으로 브라우저 열기
    port: 5173, // 포트 번호 (기본값)
  },
})

