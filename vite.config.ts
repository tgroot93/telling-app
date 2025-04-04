import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
}) 