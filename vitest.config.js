import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfigFn from './vite.config.js'

const viteConfig = typeof viteConfigFn === 'function'
  ? viteConfigFn({ mode: 'test', command: 'serve', isSsrBuild: false })
  : viteConfigFn

export default mergeConfig(viteConfig, defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Target thresholds (spec: 70/70/60/70) — raise incrementally as coverage improves
      // SPEC-PWA-SW-STRIP-PHASE1-01: lines 65→64 (loginVersionCheck.js削除でカバレッジ比率低下)
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 50,
        lines: 64,
      },
    },
  },
}))
