import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 6001,
    proxy: {
      // 将API请求代理到后端服务器
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // 将退出请求代理到后端服务器
      '/logout': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
