import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * J-INFRA-02: Husky pre-push gate のコンポーネント検証
 *
 * Case 1: vitest.config.jsにcoverageThresholdsが設定されていること
 * Case 2: test.skip追加でcheck-forbidden-patterns.shがfailすること
 * Case 3: depcruiseが循環依存を検出できること
 * Case 4: 全パターンcleanでcheck-forbidden-patterns.shがpassすること
 */

const CWD = process.cwd()

test.describe('J-INFRA-02: pre-push gate components', () => {
  test('vitest.config.jsにcoverage thresholdsが設定されていること', () => {
    const configPath = `${CWD}/vitest.config.js`
    expect(existsSync(configPath)).toBe(true)

    const content = readFileSync(configPath, 'utf8')
    expect(content).toContain('thresholds')
    expect(content).toContain('statements')
    expect(content).toContain('branches')
    expect(content).toContain('functions')
    expect(content).toContain('lines')
  })

  test('test.skipを含むファイルでcheck-forbidden-patterns.shがexit 1になること', () => {
    const tmpDir = join(tmpdir(), `infra02-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    try {
      writeFileSync(
        join(tmpDir, 'bad.test.js'),
        "test.skip('forbidden skip', () => {})\n"
      )

      // スクリプトに一時ディレクトリを渡して検査
      const result = spawnSync(
        'sh',
        ['scripts/check-forbidden-patterns.sh', `${tmpDir}/`],
        { cwd: CWD, encoding: 'utf8' }
      )

      expect(result.status).toBe(1)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('depcruiseがno-circularルールで循環依存を検出できること', () => {
    const tmpDir = join(tmpdir(), `infra02-circ-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    try {
      // a.js → b.js → a.js の循環依存
      writeFileSync(join(tmpDir, 'a.js'), "const b = require('./b')\nmodule.exports = {}\n")
      writeFileSync(join(tmpDir, 'b.js'), "const a = require('./a')\nmodule.exports = {}\n")

      const result = spawnSync(
        'npx',
        ['depcruise', tmpDir, '--validate', '.dependency-cruiser.cjs'],
        { cwd: CWD, encoding: 'utf8' }
      )

      // depcruise exits non-zero when violations found
      expect(result.status).not.toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toMatch(/no-circular|circular/)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('クリーンなコードでcheck-forbidden-patterns.shがexit 0になること', () => {
    const tmpDir = join(tmpdir(), `infra02-clean-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    try {
      writeFileSync(
        join(tmpDir, 'clean.test.js'),
        "test('valid test', () => { expect(1).toBe(1) })\n"
      )

      const result = spawnSync(
        'sh',
        ['scripts/check-forbidden-patterns.sh', `${tmpDir}/`],
        { cwd: CWD, encoding: 'utf8' }
      )

      expect(result.status).toBe(0)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
