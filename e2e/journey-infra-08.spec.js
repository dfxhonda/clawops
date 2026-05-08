import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * J-INFRA-08: agentic poll bridge (launchd + mkdir lock + claude auth)
 *
 * a: lock_conflict → silent exit 0 (同時起動保護)
 * b: no_pickup → exit 0, ntfy silent
 * c: pickup → HEAD change → ntfy on_done
 * d: failure → exit non-0 → ntfy on_failure
 * e: launchd install → launchctl list verify → uninstall 完全削除
 */

const REPO_ROOT = process.cwd()
const SCRIPT = join(REPO_ROOT, 'scripts/agentic-poll.sh')
const INSTALL_SCRIPT = join(REPO_ROOT, 'scripts/install-agentic-poll.sh')
const UNINSTALL_SCRIPT = join(REPO_ROOT, 'scripts/uninstall-agentic-poll.sh')
const PLIST_LABEL = 'com.dfx.clawops.agentic-poll'

function makeMockBin(claudeScript) {
  const tmpBin = mkdtempSync(join(tmpdir(), 'mock-infra08-'))
  writeFileSync(join(tmpBin, 'claude'), claudeScript, { mode: 0o755 })
  writeFileSync(join(tmpBin, 'curl'), [
    '#!/usr/bin/env bash',
    'echo "CURL_CALLED: $*"',
  ].join('\n'), { mode: 0o755 })
  return tmpBin
}

function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'infra08-repo-'))
  spawnSync('git', ['init'], { cwd: dir })
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  spawnSync('git', ['commit', '--allow-empty', '-m', 'initial'], { cwd: dir })
  mkdirSync(join(dir, 'logs'), { recursive: true })
  return dir
}

function runScript(env = {}) {
  return spawnSync('bash', [SCRIPT], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 15_000,
  })
}

test.describe('J-INFRA-08: agentic poll bridge', () => {
  test('a: lock_conflict → silent exit 0 (同時起動)', () => {
    const lockDir = mkdtempSync(join(tmpdir(), 'infra08-lock-'))
    // Use a unique LOCKDIR path that we pre-create to simulate an existing lock
    const testLockDir = join(lockDir, 'agentic-poll.lockdir')
    mkdirSync(testLockDir)
    try {
      const result = runScript({ AGENTIC_LOCKDIR: testLockDir })
      // lock_conflict: exit 0 silently — no "start pid=" output
      expect(result.status).toBe(0)
      const out = result.stdout + result.stderr
      expect(out).not.toContain('start pid=')
    } finally {
      rmSync(lockDir, { recursive: true, force: true })
    }
  })

  test('b: no_pickup → exit 0, ntfy silent', () => {
    const repoDir = makeTempRepo()
    const mockBin = makeMockBin([
      '#!/usr/bin/env bash',
      '# Mock: no spec ready — exit 0 silently',
      'exit 0',
    ].join('\n'))
    const lockDir = mkdtempSync(join(tmpdir(), 'infra08-lock-'))
    const testLockDir = join(lockDir, 'agentic-poll.lockdir')
    try {
      const result = runScript({
        CLAWOPS_DIR: repoDir,
        AGENTIC_LOCKDIR: testLockDir,
        PATH: `${mockBin}:${process.env.PATH}`,
        HOME: process.env.HOME || '/tmp',
      })
      expect(result.status).toBe(0)
      const out = result.stdout + result.stderr
      expect(out).toContain('no_pickup')
      // silent: curl NOT called for no_pickup
      expect(out).not.toContain('CURL_CALLED')
    } finally {
      rmSync(repoDir, { recursive: true, force: true })
      rmSync(mockBin, { recursive: true, force: true })
      rmSync(lockDir, { recursive: true, force: true })
    }
  })

  test('c: pickup → HEAD change → ntfy on_done', () => {
    const repoDir = makeTempRepo()
    const mockBin = makeMockBin([
      '#!/usr/bin/env bash',
      '# Mock: simulate pickup — commit in CLAWOPS_DIR to change HEAD',
      'CDIR="${CLAWOPS_DIR:-$HOME/clawops}"',
      'cd "$CDIR"',
      'git commit --allow-empty -m "mock: agentic-poll pickup implemented" > /dev/null 2>&1',
      'echo "spec picked up and implemented"',
      'exit 0',
    ].join('\n'))
    const lockDir = mkdtempSync(join(tmpdir(), 'infra08-lock-'))
    const testLockDir = join(lockDir, 'agentic-poll.lockdir')
    try {
      const result = runScript({
        CLAWOPS_DIR: repoDir,
        AGENTIC_LOCKDIR: testLockDir,
        PATH: `${mockBin}:${process.env.PATH}`,
        HOME: process.env.HOME || '/tmp',
      })
      expect(result.status).toBe(0)
      const out = result.stdout + result.stderr
      expect(out).toContain('pickup done commit=')
      // F: ntfy on_done
      expect(out).toContain('CURL_CALLED:')
      expect(out).toContain('agentic-poll done commit=')
    } finally {
      rmSync(repoDir, { recursive: true, force: true })
      rmSync(mockBin, { recursive: true, force: true })
      rmSync(lockDir, { recursive: true, force: true })
    }
  })

  test('d: claude failure → exit non-0 → ntfy on_failure', () => {
    const repoDir = makeTempRepo()
    const mockBin = makeMockBin([
      '#!/usr/bin/env bash',
      '# Mock: claude API failure',
      'echo "API error: rate limit exceeded" >&2',
      'exit 1',
    ].join('\n'))
    const lockDir = mkdtempSync(join(tmpdir(), 'infra08-lock-'))
    const testLockDir = join(lockDir, 'agentic-poll.lockdir')
    try {
      const result = runScript({
        CLAWOPS_DIR: repoDir,
        AGENTIC_LOCKDIR: testLockDir,
        PATH: `${mockBin}:${process.env.PATH}`,
        HOME: process.env.HOME || '/tmp',
      })
      expect(result.status).not.toBe(0)
      const out = result.stdout + result.stderr
      expect(out).toContain('ERROR')
      // F: ntfy on_failure
      expect(out).toContain('CURL_CALLED:')
      expect(out).toContain('agentic-poll failure exit=')
    } finally {
      rmSync(repoDir, { recursive: true, force: true })
      rmSync(mockBin, { recursive: true, force: true })
      rmSync(lockDir, { recursive: true, force: true })
    }
  })

  test('e: launchd install → launchctl list confirm → uninstall 完全削除', () => {
    // uninstall first (cleanup any previous state)
    spawnSync('bash', [UNINSTALL_SCRIPT], { encoding: 'utf8', timeout: 10_000 })

    // install
    const installResult = spawnSync('bash', [INSTALL_SCRIPT], {
      encoding: 'utf8',
      timeout: 15_000,
    })
    expect(installResult.stdout + installResult.stderr).toContain('loaded')
    expect(installResult.status).toBe(0)

    try {
      // verify launchctl list shows the job
      const listResult = spawnSync('launchctl', ['list'], { encoding: 'utf8', timeout: 5_000 })
      expect(listResult.stdout).toContain(PLIST_LABEL)

      // plist file should exist
      const plistPath = `${process.env.HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist`
      expect(existsSync(plistPath)).toBe(true)
    } finally {
      // uninstall — always clean up
      const uninstallResult = spawnSync('bash', [UNINSTALL_SCRIPT], {
        encoding: 'utf8',
        timeout: 10_000,
      })
      expect(uninstallResult.status).toBe(0)
    }

    // verify job is gone
    const listAfter = spawnSync('launchctl', ['list'], { encoding: 'utf8', timeout: 5_000 })
    expect(listAfter.stdout).not.toContain(PLIST_LABEL)
  })
})
