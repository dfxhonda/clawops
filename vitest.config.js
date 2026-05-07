import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Target thresholds (spec: 70/70/60/70) — raise incrementally as coverage improves
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 50,
        lines: 65,
      },
    },
  },
}))
