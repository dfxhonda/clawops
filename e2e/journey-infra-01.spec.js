import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'

/**
 * J-INFRA-01: ESLint boundaries + dependency-cruiser
 *
 * Case 1: clawsupport→tanasupport のscope越境インポートがESLint errorになること
 * Case 2: 全既存ファイルがlint passすること
 * Case 3: .dependency-cruiser.cjsが存在し循環依存なしでdepcruiseが通ること
 */

const CWD = process.cwd()

test.describe('J-INFRA-01: ESLint boundaries', () => {
  test('clawsupport→tanasupport scope越境インポートがESLint errorになること', () => {
    // boundaries plugin requires target file to exist for element-type resolution.
    // Use stdin + stdin-filename with an existing tanasupport file as the target.
    const violatingCode = "import foo from '../tanasupport/stocktake/api'"

    const result = spawnSync(
      'npx',
      [
        'eslint',
        '--stdin',
        '--stdin-filename', 'src/clawsupport/ViolationTest.js',
        '--no-ignore',
      ],
      {
        input: violatingCode,
        cwd: CWD,
        encoding: 'utf8',
      }
    )

    // boundaries/dependencies violation → ESLint exits non-zero
    expect(result.status).not.toBe(0)
    const output = result.stdout + result.stderr
    expect(output).toMatch(/boundaries\/dependencies/)
  })

  test('全既存ファイルがlint passすること', () => {
    const result = spawnSync(
      'npx',
      ['eslint', 'src/', '--max-warnings', '0'],
      { cwd: CWD, encoding: 'utf8' }
    )

    if (result.status !== 0) {
      const output = result.stdout + result.stderr
      throw new Error(`ESLint failed:\n${output}`)
    }

    expect(result.status).toBe(0)
  })

  test('.dependency-cruiser.cjsが存在し循環依存なしでdepcruiseが通ること', () => {
    // config file exists
    expect(existsSync(`${CWD}/.dependency-cruiser.cjs`)).toBe(true)

    // no-circular rule is defined
    const config = readFileSync(`${CWD}/.dependency-cruiser.cjs`, 'utf8')
    expect(config).toContain('no-circular')

    // depcruise runs clean on src/
    const result = spawnSync(
      'npx',
      ['depcruise', 'src', '--validate', '.dependency-cruiser.cjs'],
      { cwd: CWD, encoding: 'utf8' }
    )

    if (result.status !== 0) {
      const output = result.stdout + result.stderr
      throw new Error(`depcruise failed:\n${output}`)
    }

    expect(result.status).toBe(0)
  })
})
