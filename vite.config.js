import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'https://aiapi.369900.xyz',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // 根据需要决定是否重写路径，如果后端就是 /api/lol/... 那么就不需要
      }
    }
  }
})
