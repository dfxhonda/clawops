import { test, expect } from '@playwright/test'
import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * J-INFRA-10: Notion MCP write scope recovery
 *
 * a: reauth.sh prints the correct claude.ai re-auth URL
 * b: reauth.sh sends ntfy when NTFY_TOPIC is set (curl mock)
 * c: verify.sh exits 1 when NOTION_API_KEY is missing
 * d: verify.sh calls curl with Notion API endpoint when key is provided (curl mock)
 * e: settings.local.json allow list includes notion-create-pages
 */

const REPO_ROOT = process.cwd()
const REAUTH_SCRIPT  = join(REPO_ROOT, 'scripts/notion-mcp-reauth.sh')
const VERIFY_SCRIPT  = join(REPO_ROOT, 'scripts/notion-mcp-verify.sh')
const SETTINGS_JSON  = join(process.env.HOME, '.claude/settings.local.json')

const REAUTH_URL = 'https://claude.ai/settings/integrations'

function makeMockBin(curlScript) {
  const dir = mkdtempSync(join(tmpdir(), 'mock-infra10-'))
  writeFileSync(join(dir, 'curl'), curlScript, { mode: 0o755 })
  return dir
}

// J-INFRA-10a: reauth.sh prints the correct claude.ai integrations URL
test('J-INFRA-10a: reauth.sh prints claude.ai integrations URL', () => {
  const result = spawnSync('bash', [REAUTH_SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, NTFY_TOPIC: '' },
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toContain(REAUTH_URL)
})

// J-INFRA-10b: reauth.sh sends ntfy when NTFY_TOPIC is set
test('J-INFRA-10b: reauth.sh sends ntfy when NTFY_TOPIC provided', () => {
  const calls = []
  const mockDir = makeMockBin([
    '#!/usr/bin/env bash',
    'echo "CURL_CALLED: $*"',
    'exit 0',
  ].join('\n'))

  const logFile = join(mockDir, 'curl.log')
  writeFileSync(join(mockDir, 'curl'), [
    '#!/usr/bin/env bash',
    `echo "$*" >> ${logFile}`,
    'exit 0',
  ].join('\n'), { mode: 0o755 })

  const result = spawnSync('bash', [REAUTH_SCRIPT, 'test-topic-infra10'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${mockDir}:${process.env.PATH}` },
  })
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('ntfy sent')

  const log = readFileSync(logFile, 'utf8')
  expect(log).toContain('ntfy.sh/test-topic-infra10')
})

// J-INFRA-10c: verify.sh exits 1 when NOTION_API_KEY is missing
test('J-INFRA-10c: verify.sh exits 1 when NOTION_API_KEY missing', () => {
  const env = { ...process.env }
  delete env.NOTION_API_KEY

  const result = spawnSync('bash', [VERIFY_SCRIPT], {
    encoding: 'utf8',
    env,
  })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('NOTION_API_KEY')
})

// J-INFRA-10d: verify.sh calls curl with Notion API endpoint when key is set
test('J-INFRA-10d: verify.sh calls Notion API endpoint via curl', () => {
  const mockDir = makeMockBin('')
  const logFile = join(mockDir, 'curl.log')

  writeFileSync(join(mockDir, 'curl'), [
    '#!/usr/bin/env bash',
    `echo "$*" >> ${logFile}`,
    // Simulate successful read, then write, then delete
    'if [[ "$*" == *"-X PATCH"* ]]; then',
    '  echo \'{"results":[{"id":"fake-block-id"}]}\' && exit 0',
    'fi',
    'if [[ "$*" == *"-X DELETE"* ]]; then exit 0; fi',
    'echo \'{"id":"fake-page"}\' && exit 0',
  ].join('\n'), { mode: 0o755 })

  const result = spawnSync('bash', [VERIFY_SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${mockDir}:${process.env.PATH}`,
      NOTION_API_KEY: 'secret_test_key',
    },
  })

  // Script will exit 0 if curl mock behaves correctly; 1 if read fails
  // We just verify it called curl with the Notion API URL
  const log = readFileSync(logFile, 'utf8')
  expect(log).toContain('api.notion.com')
  expect(log).toContain('Authorization: Bearer secret_test_key')
})

// J-INFRA-10e: settings.local.json allow list includes notion-create-pages (local dev only)
test('J-INFRA-10e: settings.local.json includes notion-create-pages in allow list', () => {
  if (!existsSync(SETTINGS_JSON)) return
  const raw = readFileSync(SETTINGS_JSON, 'utf8')
  const settings = JSON.parse(raw)
  const allow = settings?.permissions?.allow ?? []
  expect(allow).toContain('mcp__claude_ai_Notion__notion-create-pages')
})
