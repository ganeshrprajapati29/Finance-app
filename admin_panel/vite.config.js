import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/admin': {
        target: 'https://khatupay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/admin', '/api/admin')
      },
      '/auth': {
        target: 'https://khatupay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/auth', '/api/auth')
      },
      '/employee': {
        target: 'https://khatupay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/employee', '/api/employee')
      }
    }
  }
})
