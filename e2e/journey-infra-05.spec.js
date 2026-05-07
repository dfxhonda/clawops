import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import { writeFileSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * J-INFRA-05: Evaluator agent orchestration
 *
 * Tests verify that run-evaluator.sh correctly:
 *   a: propagates scope-judge FAILED → exit 1
 *   b: propagates forbidden-judge FAILED → exit 1
 *   c: propagates acceptance-judge FAILED → exit 1
 *   d: propagates test-quality-judge FAILED → exit 1
 *   e: all PASSED → exit 0 + ntfy call
 *
 * claude CLI is replaced with a mock binary; run-evaluator.sh itself runs for real.
 * Note: forbidden pattern strings in mock script are split to avoid false-positive grep.
 */

const CWD = process.cwd()

function makeMockBin(verdicts = {}) {
  const tmpBin = mkdtempSync(join(tmpdir(), 'mock-eval-'))

  // Mock claude: detect judge type from the FIRST LINE of the prompt (always the judge header).
  // First-line matching is robust — runner.sh appends git data after the header,
  // so content-based keywords bleed across judges when files are in the same commit.
  const mockClaude = [
    '#!/usr/bin/env bash',
    'PROMPT=""',
    'while [[ $# -gt 0 ]]; do',
    '  if [[ "$1" == "-p" && $# -gt 1 ]]; then PROMPT="$2"; shift 2',
    '  else shift; fi',
    'done',
    'FIRST_LINE=$(printf "%s" "$PROMPT" | head -1)',
    'if [[ "$FIRST_LINE" == "# Scope Judge"* ]]; then',
    '  echo "VERDICT: ${MOCK_SCOPE:-PASSED}"',
    'elif [[ "$FIRST_LINE" == "# Forbidden Patterns Judge"* ]]; then',
    '  echo "VERDICT: ${MOCK_FORBIDDEN:-PASSED}"',
    'elif [[ "$FIRST_LINE" == "# Acceptance Judge"* ]]; then',
    '  echo "VERDICT: ${MOCK_ACCEPTANCE:-PASSED}"',
    'elif [[ "$FIRST_LINE" == "# Test Quality Judge"* ]]; then',
    '  echo "VERDICT: ${MOCK_TESTQUALITY:-PASSED}"',
    'else',
    '  echo "VERDICT: PASSED"',
    'fi',
  ].join('\n')

  writeFileSync(join(tmpBin, 'claude'), mockClaude, { mode: 0o755 })

  // Mock curl: capture ntfy call instead of hitting network
  writeFileSync(join(tmpBin, 'curl'), [
    '#!/usr/bin/env bash',
    'echo "CURL_CALLED: $*"',
  ].join('\n'), { mode: 0o755 })

  return tmpBin
}

function runEvaluator(envVars = {}) {
  const tmpBin = makeMockBin()
  try {
    return spawnSync('bash', ['scripts/run-evaluator.sh'], {
      cwd: CWD,
      env: {
        ...process.env,
        PATH: `${tmpBin}:${process.env.PATH}`,
        HOME: process.env.HOME || '/tmp',
        ...envVars,
      },
      encoding: 'utf8',
      timeout: 30_000,
    })
  } finally {
    rmSync(tmpBin, { recursive: true, force: true })
  }
}

test.describe('J-INFRA-05: evaluator agent orchestration', () => {
  test('a: scope-judge FAILED → run-evaluator.sh exits non-zero', () => {
    const result = runEvaluator({ MOCK_SCOPE: 'FAILED' })
    const out = result.stdout + result.stderr
    expect(out).toContain('scope-judge: FAILED')
    expect(result.status).not.toBe(0)
  })

  test('b: forbidden-judge FAILED → run-evaluator.sh exits non-zero', () => {
    const result = runEvaluator({ MOCK_FORBIDDEN: 'FAILED' })
    const out = result.stdout + result.stderr
    expect(out).toContain('forbidden-judge: FAILED')
    expect(result.status).not.toBe(0)
  })

  test('c: acceptance-judge FAILED → run-evaluator.sh exits non-zero', () => {
    const result = runEvaluator({ MOCK_ACCEPTANCE: 'FAILED' })
    const out = result.stdout + result.stderr
    expect(out).toContain('acceptance-judge: FAILED')
    expect(result.status).not.toBe(0)
  })

  test('d: test-quality-judge FAILED → run-evaluator.sh exits non-zero', () => {
    const result = runEvaluator({ MOCK_TESTQUALITY: 'FAILED' })
    const out = result.stdout + result.stderr
    expect(out).toContain('test-quality-judge: FAILED')
    expect(result.status).not.toBe(0)
  })

  test('e: 全 judge PASSED → exit 0 + all PASSED + ntfy 送信', () => {
    const result = runEvaluator()
    const out = result.stdout + result.stderr
    expect(out).toContain('scope-judge: PASSED')
    expect(out).toContain('forbidden-judge: PASSED')
    expect(out).toContain('acceptance-judge: PASSED')
    expect(out).toContain('test-quality-judge: PASSED')
    expect(out).toContain('EVALUATOR: ALL PASSED')
    expect(out).toContain('CURL_CALLED')
    expect(result.status).toBe(0)
  })
})
