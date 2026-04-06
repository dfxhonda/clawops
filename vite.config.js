import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // vendor: React + Router + Supabase を1チャンクに分離
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          // QRスキャンは巡回画面でしか使わない
          qrscanner: ['html5-qrcode'],
        }
      }
    }
  }
})
