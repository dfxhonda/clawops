import { test, expect } from '@playwright/test'
import { spawnSync, execSync } from 'child_process'
import { writeFileSync, rmSync, mkdtempSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'

/**
 * J-INFRA-06: Evaluator self-update protection (INC-008 fix)
 *
 * Tests verify updated scope-judge and forbidden-judge correctly apply:
 *   a: scripts/eval/* changed without [approved-by command-tower] → scope-judge FAILED
 *   b: scripts/eval/* changed + [approved-by command-tower] → scope-judge PASSED bypass
 *   c: commit message contains ボーナス → forbidden-judge FAILED
 *   d: src/* + scripts/eval/* mixed commit (no bypass) → scope-judge FAILED
 *   e: J-REVENUE-A 3-commit structure re-enacted → all scope-judge FAILED
 *
 * Runs real scripts/run-evaluator.sh against temporary git repos.
 * Mock claude implements INC-008 rules; real judge .md files are used.
 * Forbidden pattern strings in mock split where needed per Phase A 406b082 style.
 */

const REPO_ROOT = process.cwd()

function makeMockBin() {
  const tmpBin = mkdtempSync(join(tmpdir(), 'mock-infra06-'))

  // Mock claude: implements INC-008 universal rules.
  // Uses awk to extract sections from runner output, avoiding false positives
  // from judge markdown content (which may contain the same keywords as rules).
  const mockClaude = [
    '#!/usr/bin/env bash',
    'PROMPT=""',
    'while [[ $# -gt 0 ]]; do',
    "  if [[ \"$1\" == \"-p\" && $# -gt 1 ]]; then PROMPT=\"$2\"; shift 2",
    '  else shift; fi',
    'done',
    "FIRST=$(printf '%s' \"$PROMPT\" | head -1)",
    '',
    "if printf '%s' \"$FIRST\" | grep -q 'Scope Judge'; then",
    '  # Extract sections from runner output to avoid false positives',
    "  FILES=$(printf '%s' \"$PROMPT\" | awk '/=== Changed files/{f=1;next} f && /^===/{f=0} f{print}')",
    "  CMSG=$(printf '%s' \"$PROMPT\" | awk '/=== Commit message/{f=1;next} f && /^===/{f=0} f{print}')",
    '  # Rule U1: evaluator infrastructure paths in changed files',
    "  HAS_EVAL=$(printf '%s' \"$FILES\" | grep -qE '^scripts/eval/|^scripts/run-evaluator\\.sh|^\\.husky/post-commit' && echo 1 || echo 0)",
    '  # bypass tag check in commit message section',
    "  HAS_BYPASS=$(printf '%s' \"$CMSG\" | grep -qF '[approved-by command-tower]' && echo 1 || echo 0)",
    '  # Rule U2: src/* present in changed files',
    "  HAS_SRC=$(printf '%s' \"$FILES\" | grep -qE '^src/' && echo 1 || echo 0)",
    '  # scripts/eval/* present in changed files',
    "  HAS_EVAL2=$(printf '%s' \"$FILES\" | grep -qE '^scripts/eval/' && echo 1 || echo 0)",
    '  # Rule U2: src + eval mixed → FAILED (no bypass override)',
    '  if [ "$HAS_SRC" = "1" ] && [ "$HAS_EVAL2" = "1" ]; then',
    '    echo "VERDICT: FAILED"',
    '  # Rule U1 bypass: eval changed + bypass tag → full PASSED',
    '  elif [ "$HAS_EVAL" = "1" ] && [ "$HAS_BYPASS" = "1" ]; then',
    '    echo "VERDICT: PASSED"',
    '  # Rule U1: eval changed + no bypass → FAILED',
    '  elif [ "$HAS_EVAL" = "1" ] && [ "$HAS_BYPASS" = "0" ]; then',
    '    echo "VERDICT: FAILED"',
    '  else',
    '    echo "VERDICT: PASSED"',
    '  fi',
    '',
    "elif printf '%s' \"$FIRST\" | grep -q 'Forbidden'; then",
    '  # Extract commit message section only — avoids false positives from judge markdown',
    "  CMSG=$(printf '%s' \"$PROMPT\" | awk '/=== Commit message/{f=1;next} f && /^===/{f=0} f{print}')",
    '  # Scope-creep patterns in commit message. Compound phrases only; "fix" alone is OK.',
    "  HAS_BONUS=$(printf '%s' \"$CMSG\" | grep -qE 'ボーナス|ついでに|以外にも|bonus fix|also fixed|while at it' && echo 1 || echo 0)",
    '  if [ "$HAS_BONUS" = "1" ]; then',
    '    echo "VERDICT: FAILED"',
    '  else',
    '    echo "VERDICT: PASSED"',
    '  fi',
    '',
    'else',
    '  echo "VERDICT: PASSED"',
    'fi',
  ].join('\n')

  writeFileSync(join(tmpBin, 'claude'), mockClaude, { mode: 0o755 })
  writeFileSync(join(tmpBin, 'curl'), [
    '#!/usr/bin/env bash',
    'echo "CURL_CALLED: $*"',
  ].join('\n'), { mode: 0o755 })

  return tmpBin
}

function makeTempRepo({ changedFiles = [], commitMessage = 'test: scenario' }) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'infra06-repo-'))

  execSync('git init', { cwd: tmpDir })
  execSync('git config user.email "test@test.com"', { cwd: tmpDir })
  execSync('git config user.name "Test"', { cwd: tmpDir })
  execSync('git commit --allow-empty -m "initial"', { cwd: tmpDir })

  for (const filePath of changedFiles) {
    const fileDir = dirname(join(tmpDir, filePath))
    mkdirSync(fileDir, { recursive: true })
    writeFileSync(join(tmpDir, filePath), `# test: ${filePath}\n`)
  }

  if (changedFiles.length > 0) {
    execSync('git add -A', { cwd: tmpDir })
  }
  execSync(`git commit --allow-empty -m ${JSON.stringify(commitMessage)}`, { cwd: tmpDir })

  return tmpDir
}

function runEvaluatorInRepo(repoDir) {
  const tmpBin = makeMockBin()
  try {
    return spawnSync('bash', [join(REPO_ROOT, 'scripts/run-evaluator.sh')], {
      cwd: repoDir,
      env: {
        ...process.env,
        PATH: `${tmpBin}:${process.env.PATH}`,
        HOME: process.env.HOME || '/tmp',
      },
      encoding: 'utf8',
      timeout: 30_000,
    })
  } finally {
    rmSync(tmpBin, { recursive: true, force: true })
  }
}

test.describe('J-INFRA-06: evaluator self-update protection (INC-008 fix)', () => {
  test('a: scripts/eval/* 変更 (approved tag なし) → scope-judge FAILED', () => {
    const repo = makeTempRepo({
      changedFiles: ['scripts/eval/scope-judge.md'],
      commitMessage: 'chore: update scope judge',
    })
    try {
      const result = runEvaluatorInRepo(repo)
      const out = result.stdout + result.stderr
      expect(out).toContain('scope-judge: FAILED')
      expect(result.status).not.toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('b: scripts/eval/* 変更 + [approved-by command-tower] → scope-judge PASSED bypass', () => {
    const repo = makeTempRepo({
      changedFiles: ['scripts/eval/scope-judge.md'],
      commitMessage: 'chore: update scope judge [approved-by command-tower]',
    })
    try {
      const result = runEvaluatorInRepo(repo)
      const out = result.stdout + result.stderr
      expect(out).toContain('scope-judge: PASSED')
      expect(result.status).toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('c: commit message にボーナス → forbidden-judge FAILED', () => {
    const repo = makeTempRepo({
      changedFiles: ['src/index.js'],
      // ボーナス in commit message triggers INC-008 forbidden rule
      commitMessage: 'feat: new feature ボーナス修正も含む',
    })
    try {
      const result = runEvaluatorInRepo(repo)
      const out = result.stdout + result.stderr
      expect(out).toContain('forbidden-judge: FAILED')
      expect(result.status).not.toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('d: src/* + scripts/eval/* 混在 (no bypass) → scope-judge FAILED', () => {
    const repo = makeTempRepo({
      changedFiles: ['src/admin/AdminTop.jsx', 'scripts/eval/scope-judge.md'],
      commitMessage: 'feat: update feature and evaluator together',
    })
    try {
      const result = runEvaluatorInRepo(repo)
      const out = result.stdout + result.stderr
      expect(out).toContain('scope-judge: FAILED')
      expect(result.status).not.toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('e: J-REVENUE-A 3 commit 構成 mock 再現 → 全 scope-judge FAILED', () => {
    const scenarios = [
      {
        // ffb2f3e-like: src/* + scripts/eval/* 混在 (no bypass)
        changedFiles: ['src/admin/AdminTop.jsx', 'scripts/eval/scope-judge.md'],
        commitMessage: 'feat(J-REVENUE-A): 売上分析モジュール実装',
      },
      {
        // 2650675-like: scripts/eval/*.md 変更、bypass tag なし
        changedFiles: ['scripts/eval/scope-judge.md', 'scripts/eval/acceptance-judge.md'],
        commitMessage: 'chore(evaluator): scope-judge + acceptance-judge を J-REVENUE-A 用に更新',
      },
      {
        // a258a29-like: scripts/eval/*.md 変更、bypass tag なし
        changedFiles: ['scripts/eval/scope-judge.md'],
        commitMessage: 'chore(evaluator): scope-judge に acceptance-judge.md パスを追加',
      },
    ]

    for (const [i, scenario] of scenarios.entries()) {
      const repo = makeTempRepo(scenario)
      try {
        const result = runEvaluatorInRepo(repo)
        const out = result.stdout + result.stderr
        expect(out, `シナリオ ${i + 1}: scope-judge FAILED が必要`).toContain('scope-judge: FAILED')
        expect(result.status, `シナリオ ${i + 1}: non-zero exit が必要`).not.toBe(0)
      } finally {
        rmSync(repo, { recursive: true, force: true })
      }
    }
  })
})
