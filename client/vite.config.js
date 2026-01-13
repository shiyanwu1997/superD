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
  },
  build: {
    // 调整代码块大小警告阈值
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          // 将大型UI框架单独打包
          antd: ['antd', '@ant-design/icons'],
          // 将终端组件单独打包
          xterm: ['@xterm/xterm', '@xterm/addon-fit'],
          // 将路由相关依赖单独打包
          router: ['react-router-dom'],
          // 将数据请求库单独打包
          query: ['@tanstack/react-query'],
          // 将实时通信库单独打包
          socket: ['socket.io-client'],
          // 将HTTP请求库单独打包
          axios: ['axios']
        }
      }
    }
  }
})
