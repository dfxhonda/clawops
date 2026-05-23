import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
let gitSha = 'unknown'
let buildNumber = '0'
try { gitSha = execSync('git rev-parse --short HEAD').toString().trim() } catch {}
try { buildNumber = execSync('git rev-list --count HEAD').toString().trim() } catch {}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'version-json',
      writeBundle() {
        writeFileSync('dist/version.json', JSON.stringify({ sha: gitSha, buildNumber, version: pkg.version }))
      }
    },
  ],
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '.claude/worktrees/**'],
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-vitest-only',
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // vendor: React + Router + Supabase を1チャンクに分離
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          // QRスキャンは巡回画面でしか使わない
          qrscanner: ['html5-qrcode'],
          // QRコード生成はQR印刷画面専用
          qrcode: ['qrcode'],
        }
      }
    }
  }
}))
