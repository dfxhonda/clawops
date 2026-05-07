import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, statSync } from 'fs'
import { resolve } from 'path'

// J-INFRA-03: supabase gen types — ファイル存在・スクリプト定義・Database型エクスポート

const ROOT = resolve(process.cwd())

test.describe('J-INFRA-03: Supabase TypeScript 型生成', () => {
  test('src/types/supabase.d.ts が存在する', () => {
    const typesPath = resolve(ROOT, 'src/types/supabase.d.ts')
    expect(existsSync(typesPath)).toBe(true)
  })

  test('gen-types スクリプトが package.json に定義されており shell スクリプトが存在する', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
    expect(pkg.scripts['gen-types']).toBe('bash scripts/gen-supabase-types.sh')

    const shPath = resolve(ROOT, 'scripts/gen-supabase-types.sh')
    expect(existsSync(shPath)).toBe(true)

    const mode = statSync(shPath).mode
    // executable bit が立っていることを確認 (user execute: 0o100)
    expect(mode & 0o100).toBeTruthy()
  })

  test('supabase.d.ts が Database 型を export している', () => {
    const content = readFileSync(resolve(ROOT, 'src/types/supabase.d.ts'), 'utf8')
    expect(content).toContain('export type Database =')
    expect(content).toContain('prize_masters')
    expect(content).toContain('meter_readings')
    expect(content).toContain('machines')
    expect(content).toContain('stores')
  })
})
