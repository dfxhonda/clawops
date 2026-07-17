import { test, expect } from '@playwright/test'
import { setupAuth, setupPatrolMocks } from './helpers'

// SPEC-OCR-ANDROID-CAMERA-2BTN-HOTFIX-01 (D-082) AC1:
// 巡回OCR読み取りを 撮影(capture=environment=カメラ直行) / ギャラリー(capture無) の2入力+2ボタンに分離。
// Android14+ の Chrome フォトピッカー仕様変更で capture 無 input はカメラ選択肢が消えギャラリー直行する回帰の hotfix。
// DOM 属性を chromium+webkit 両engineで検証 (実際のカメラ起動は端末依存だが、capture 属性の有無が挙動を決める)。

function injectState(page, path, state) {
  return page.addInitScript(
    ({ p, s }) => { window.history.replaceState({ usr: s, key: 'e2e-ocr2btn' }, '', p) },
    { p: path, s: state },
  )
}

test.describe('D-082 OCR android camera 2-button', () => {
  test('撮影input=capture=environment / ギャラリーinput=capture無 / 2ボタン可視', async ({ page }) => {
    await setupAuth(page, { role: 'patrol' })
    await setupPatrolMocks(page)
    await page.route('**/rest/v1/feature_flags**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ flag_key: 'patrol_core', enabled: true }]) }))

    const machine = {
      machine_code: 'TST01-M001',
      machine_name: 'テスト機',
      store_code: 'TST01',
      machine_models: { out_meter_count: 1, meter_unit_price: 100 },
      booths: [{ booth_code: 'TST-M01-B01', booth_number: 1 }],
    }
    const boothList = machine.booths.map((b) => ({ booth: b, machine }))
    const state = { machine, booth: machine.booths[0], storeCode: 'TST01', boothList, boothIndex: 0 }
    await injectState(page, '/clawsupport/booth/TST-M01-B01', state)
    await page.goto('/clawsupport/booth/TST-M01-B01', { waitUntil: 'domcontentloaded' })

    const camera = page.getByTestId('ocr-camera-input')
    const gallery = page.getByTestId('ocr-gallery-input')
    await expect(camera).toBeAttached({ timeout: 10_000 })
    await expect(gallery).toBeAttached()

    // 撮影input は capture=environment、ギャラリーinput は capture 無し
    expect(await camera.getAttribute('capture')).toBe('environment')
    expect(await gallery.getAttribute('capture')).toBeNull()
    // 両 input とも accept=image/*
    expect(await camera.getAttribute('accept')).toBe('image/*')
    expect(await gallery.getAttribute('accept')).toBe('image/*')

    // 読み取りトリガー → 撮影/ギャラリー 2ボタンの選択シートが出る
    await page.getByTestId('ocr-button-inline').click()
    await expect(page.getByTestId('ocr-source-picker')).toBeVisible()
    await expect(page.getByTestId('ocr-source-camera')).toBeVisible()
    await expect(page.getByTestId('ocr-source-gallery')).toBeVisible()
  })
})
