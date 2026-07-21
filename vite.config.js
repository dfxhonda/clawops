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
      // prompt は新SWを waiting に留め自動reloadを撃たない。更新適用はバナータップ→updateSW(true) に一本化。
      // SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): 層3 workbox skipWaiting/clientsClaim を除去。
      //   D-108実測で skipWaiting を有効にすると新SWが waiting に留まらず即activate→画面フラッシュ(自動reload)=巡回入力中に飛ぶと入力吹き飛び(安全tier違反)。
      //   prompt戦略に skipWaiting/clientsClaim を手足しするのは autoUpdate相当の暴発を自作していた誤り (vite-plugin-pwa公式: prompt時は付けない)。
      //   precache は globPatterns + MD5改訂ハッシュで担保され skipWaiting/clientsClaim とは無関係 (D-095コメントの「precacheに必要」は誤解)。
      // SPEC-PWA-SW-IOS-DETECT-FIX-01 (D-111) AC4 updateViaCache:'none' 相当:
      //   vite-plugin-pwa 1.3.0 は SW登録を new Workbox("__SW__", { scope, type }) にハードコードしており updateViaCache を注入する経路が無い (dist/client 実査済)。
      //   目的(SWスクリプト取得時のHTTPキャッシュをバイパスし Safari の積極キャッシュで検知が遅れるのを防ぐ)は、
      //   vercel.json の /sw.js = "Cache-Control: no-cache, no-store, must-revalidate" が既に達成済 (SWスクリプトは常に再検証、stale配信なし)。
      //   ⇒ updateViaCache:'none' の実効等価は vercel.json 側で成立。プラグイン設定側は変更不能につき据置。
      registerType: 'prompt',
      injectRegister: null,
      manifest: false,
      workbox: {
        // 適用タイミングは prompt(バナータップ→updateSW(true)) 制御。skipWaiting/clientsClaim は付けない(=新SWを waiting に正しく留める)。
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
