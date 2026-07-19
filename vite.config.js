import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
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
    // FIX1: VERCEL_ENV はサーバー側のみ公開の system env var。VITE_ prefix なしのため Vite 自動露出なし。
    // ビルド時 process.env.VERCEL_ENV を define で bake-in → Sentry に production/preview/development が届く。
    // VITE_VERCEL_ENV=$VERCEL_ENV の Vercel 設定が未展開でも影響なし。
    __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'),
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['bcryptjs'],
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
    VitePWA({
      // SPEC-PWA-SW-AUTOUPDATE-KILL-RELOAD-LOOP-01 (D-095, P0): 'autoUpdate' → 'prompt'。
      // autoUpdate は新SW検知で自動即reload(skipWaiting+clientsClaim強制)を撃ち、versionReload.js の堅牢な
      // 一本化層(/login限定・controllerchange待ち・sha単位1回ガード)をバイパス → iOS26 Safari 初回で黒チカチカ無限reload の主犯。
      // prompt は新SWを waiting に留め自動reloadを撃たない。更新適用は /login の versionReload に一本化 (割り込みreloadゼロ)。
      // workbox の skipWaiting/clientsClaim/cleanupOutdatedCaches/navigateFallback/globPatterns は precache に必要なため現状維持。
      registerType: 'prompt',
      injectRegister: null,
      manifest: false,
      workbox: {
        // SPEC-PWA-SW-AUTOUPDATE-PHASE2-01: autoUpdate策略。skipWaiting+clientsClaimで世代スキップ。
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/assets\//,
          /^\/docs\//,
          /\/version\.json/,
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html}'],
      },
    }),
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
