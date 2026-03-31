import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync } from 'fs'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'copy-docs',
      closeBundle() {
        cpSync('docs', 'dist/docs', { recursive: true })
      }
    }
  ]
})
