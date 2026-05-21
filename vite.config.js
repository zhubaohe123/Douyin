import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 数据库后端 API（需在通用 /api 之前匹配）
      '/api/db': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://10.11.1.88',
        changeOrigin: true,
      },
      '/justoneapi-global': {
        target: 'https://api.justoneapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/justoneapi-global/, '')
      },
      '/justoneapi-cn': {
        target: 'http://47.117.133.51:30015',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/justoneapi-cn/, '')
      }
    }
  }
})
