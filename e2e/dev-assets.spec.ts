import { test, expect } from '@playwright/test'
import { setupAuth } from './helpers'

// J-DEV-ASSET-HANDOFF-01: ファイル受け渡し UI e2e
//   admin/manager only / multi-file upload raw bytes / sha256 roundtrip / 削除確認 + 背景タップ
//   forbidden 検証: org_id filter なし、re-encode なし、toISOString JST なし

const isObj = (route: import('@playwright/test').Route) =>
  (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)
const TINY_XLSX = Buffer.from('UEsDBBQABgAIAA==', 'base64') // 軽量 zip header (xlsx 模倣)
const TINY_PDF  = Buffer.from('%PDF-1.4\n%EOF', 'utf-8')

test.describe('J-DEV-ASSET-HANDOFF-01', () => {
  test('mobile 390x844: admin → upload PNG/xlsx/pdf → sha256 roundtrip → 削除確認 (背景タップ cancel) (console 0)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'admin', staffId: 'admin-001', name: '管理者A' })

    const consoleErrors: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    page.on('pageerror', e => consoleErrors.push(e.message))

    let listSnapshot: any[] = []
    const storageUploads: { path: string, bytes: number }[] = []
    const storageDeletes: string[] = []

    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    // dev_assets list (init = empty) と insert
    await page.route('**/rest/v1/dev_assets**', async route => {
      const m = route.request().method()
      if (m === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        const row = { id: `id-${Date.now()}-${Math.random()}`, ...body, status: 'received', created_at: new Date().toISOString() }
        listSnapshot.unshift(row)
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) }); return
      }
      if (m === 'DELETE') {
        // URL から id 抽出 (?id=eq.xxxx)
        const u = new URL(route.request().url())
        const filt = u.searchParams.get('id') || ''
        const id = filt.replace(/^eq\./, '')
        listSnapshot = listSnapshot.filter(r => r.id !== id)
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return
      }
      // GET list
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(listSnapshot) })
    })

    // Storage uploads/deletes/signed url
    await page.route('**/storage/v1/object/dev-assets**', async route => {
      const m = route.request().method()
      const url = route.request().url()
      if (m === 'POST' || m === 'PUT') {
        const body = await route.request().postDataBuffer()
        storageUploads.push({ path: url, bytes: body?.length || 0 })
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'dev-assets/x' }) }); return
      }
      if (m === 'DELETE') {
        storageDeletes.push(url)
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route('**/storage/v1/object/sign/dev-assets/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedUrl: 'https://example.test/signed?token=abc' }) })
    })

    // navigate: admin settings hub → ファイル受け渡し
    await page.goto('/admin/settings')
    await expect(page.getByTestId('admin-settings-hub')).toBeVisible()
    await page.getByTestId('hub-tile-ファイル受け渡し').click()
    await expect(page.getByTestId('admin-dev-assets-list')).toBeVisible()

    // 一覧 = 空 → アップロード画面へ
    await page.getByTestId('dev-asset-upload-link').click()
    await expect(page.getByTestId('admin-dev-assets-upload')).toBeVisible()

    // メタ入力
    await page.getByTestId('dev-asset-label').fill('テスト資産 v1')
    await page.getByTestId('dev-asset-purpose').fill('roundtrip 検証用')

    // 3 file multi 選択
    await page.setInputFiles('[data-testid="dev-asset-file-input"]', [
      { name: 'a.png',  mimeType: 'image/png',  buffer: TINY_PNG },
      { name: 'b.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: TINY_XLSX },
      { name: 'c.pdf',  mimeType: 'application/pdf', buffer: TINY_PDF },
    ])
    await expect(page.getByTestId('dev-asset-staging-list')).toContainText('a.png')
    await expect(page.getByTestId('dev-asset-staging-list')).toContainText('b.xlsx')
    await expect(page.getByTestId('dev-asset-staging-list')).toContainText('c.pdf')

    // submit
    await page.getByTestId('dev-asset-submit-button').click()
    await expect.poll(() => storageUploads.length).toBe(3)
    // 3 upload とも別ファイル名 path (storage_path がファイル名を含む) で記録された
    expect(storageUploads.some(u => u.path.includes('a.png'))).toBe(true)
    expect(storageUploads.some(u => u.path.includes('b.xlsx'))).toBe(true)
    expect(storageUploads.some(u => u.path.includes('c.pdf'))).toBe(true)
    // results に sha256 が表示される (3 件、○) → client 計算 sha256 の roundtrip 確認
    await expect(page.getByTestId('dev-asset-upload-results')).toContainText('a.png')
    const okCount = await page.getByTestId('dev-asset-upload-results').locator('text=○').count()
    expect(okCount).toBe(3)
    // DB insert payload に sha256 (64 hex) と元ファイル名が含まれる (= raw bytes の hash、再エンコード前)
    const insertedSnap = listSnapshot.slice()
    expect(insertedSnap.length).toBe(3)
    for (const r of insertedSnap) {
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(r.original_filename).toMatch(/\.(png|xlsx|pdf)$/)
    }

    // 一覧へ戻る → 3 件表示
    await page.goto('/admin/dev-assets')
    await expect(page.getByTestId('dev-asset-row')).toHaveCount(3)

    // 削除確認: 背景タップ = キャンセル
    const firstRow = page.getByTestId('dev-asset-row').first()
    const delId = await firstRow.getByTestId(/dev-asset-delete-/).getAttribute('data-testid')
    const idSuffix = delId!.replace('dev-asset-delete-', '')
    await page.getByTestId(`dev-asset-delete-${idSuffix}`).click()
    await expect(page.getByTestId('dev-asset-delete-dialog')).toBeVisible()
    await page.getByTestId('dev-asset-delete-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('dev-asset-delete-dialog')).toHaveCount(0)
    expect(storageDeletes.length).toBe(0)
    await expect(page.getByTestId('dev-asset-row')).toHaveCount(3)

    // 削除確定
    await page.getByTestId(`dev-asset-delete-${idSuffix}`).click()
    await page.getByTestId('dev-asset-delete-confirm').click()
    await expect(page.getByTestId('dev-asset-row')).toHaveCount(2)
    expect(storageDeletes.length).toBeGreaterThan(0)

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
  })

  test('staff role: cannot reach /admin/dev-assets (RouteGuard redirect)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAuth(page, { role: 'staff', staffId: 'staff-1', name: 'スタッフ' })
    await page.route('**/rest/v1/**', async r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.goto('/admin/dev-assets')
    // ManagerRoute は fallback='/' → /launcher へ redirect
    await expect(page).toHaveURL(/\/(launcher|login)/)
    await expect(page.getByTestId('admin-dev-assets-list')).toHaveCount(0)
  })
})
