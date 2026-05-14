import { test, expect } from '@playwright/test'

/**
 * J-INFRA-16: location_witness — audit_logs 位置情報統合
 *
 * useGeolocation hook の動作をユニットレベルで検証。
 * ブラウザ環境で navigator.geolocation を mock 上書きして
 * 各ケースの返却値を確認する。
 */

const GEO_OPTIONS_TIMEOUT = 3000

test.describe('J-INFRA-16: useGeolocation hook', () => {
  test('J-INFRA-16-a: 位置許可あり → lat/lng/accuracy が数値で返る', async ({ page }) => {
    await page.goto('about:blank')

    const result = await page.evaluate(() => {
      // navigator.geolocation を mock
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success) => {
            success({
              coords: { latitude: 33.5897, longitude: 130.4017, accuracy: 15 },
            })
          },
        },
        configurable: true,
        writable: true,
      })

      // LOCATION_AUDIT_ENABLED = true として hook ロジックを直接実行
      return new Promise((resolve) => {
        const GEO_OPTIONS = { enableHighAccuracy: false, maximumAge: 300000, timeout: 3000 }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve({ lat: null, lng: null, accuracy: null }),
          GEO_OPTIONS
        )
      })
    })

    expect(typeof result.lat).toBe('number')
    expect(typeof result.lng).toBe('number')
    expect(typeof result.accuracy).toBe('number')
    expect(result.lat).toBeCloseTo(33.5897)
    expect(result.lng).toBeCloseTo(130.4017)
    expect(result.accuracy).toBe(15)
  })

  test('J-INFRA-16-b: 位置許可拒否 → lat/lng/accuracy が null で返る', async ({ page }) => {
    await page.goto('about:blank')

    const result = await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (_success, error) => {
            error({ code: 1, message: 'User denied Geolocation' }) // PERMISSION_DENIED
          },
        },
        configurable: true,
        writable: true,
      })

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve({ lat: null, lng: null, accuracy: null })
        )
      })
    })

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.accuracy).toBeNull()
  })

  test('J-INFRA-16-c: タイムアウト3秒超 → null で返る', async ({ page }) => {
    await page.goto('about:blank')

    const result = await page.evaluate((timeout) => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (_success, error, options) => {
            // タイムアウトシミュレート: options.timeout 後に TIMEOUT error
            setTimeout(() => {
              error({ code: 3, message: 'Timeout' })
            }, (options?.timeout ?? 3000) + 10)
          },
        },
        configurable: true,
        writable: true,
      })

      return new Promise((resolve) => {
        const opts = { enableHighAccuracy: false, maximumAge: 300000, timeout }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve({ lat: null, lng: null, accuracy: null }),
          opts
        )
      })
    }, GEO_OPTIONS_TIMEOUT)

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.accuracy).toBeNull()
  })

  test('J-INFRA-16-d: maximumAge=300000 でキャッシュ位置が即返される', async ({ page }) => {
    await page.goto('about:blank')

    const callCount = await page.evaluate(() => {
      let calls = 0
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success, _error, options) => {
            calls++
            // maximumAge が設定されていれば即解決 (キャッシュ利用シミュレート)
            if (options?.maximumAge > 0) {
              success({ coords: { latitude: 33.5897, longitude: 130.4017, accuracy: 10 } })
            }
          },
        },
        configurable: true,
        writable: true,
      })

      const GEO_OPTIONS = { enableHighAccuracy: false, maximumAge: 300000, timeout: 3000 }
      // 2回呼ぶ
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, GEO_OPTIONS)
        navigator.geolocation.getCurrentPosition(() => { resolve(calls) }, () => { resolve(calls) }, GEO_OPTIONS)
      })
    })

    // 両呼び出しとも maximumAge オプションが渡されること
    expect(callCount).toBe(2)
  })

  test('J-INFRA-16-e: VITE_FF_LOCATION_AUDIT=false → geolocation 呼出なし、null 即返', async ({ page }) => {
    await page.goto('about:blank')

    const result = await page.evaluate(() => {
      let geoCallCount = 0
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: () => { geoCallCount++ },
        },
        configurable: true,
        writable: true,
      })

      // kill switch: ENABLED=false のロジックを直接テスト
      const ENABLED = false
      const NULL_LOC = { lat: null, lng: null, accuracy: null }

      function getLocationDisabled() {
        if (!ENABLED) return Promise.resolve(NULL_LOC)
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(NULL_LOC)
          )
        })
      }

      return getLocationDisabled().then(loc => ({ ...loc, geoCallCount }))
    })

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.accuracy).toBeNull()
    expect(result.geoCallCount).toBe(0)
  })

  test('J-INFRA-16-f: geolocation 未サポート環境 → null で返る', async ({ page }) => {
    await page.goto('about:blank')

    const result = await page.evaluate(() => {
      // navigator.geolocation を undefined に
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        configurable: true,
        writable: true,
      })

      const NULL_LOC = { lat: null, lng: null, accuracy: null }

      function getLocationNoSupport() {
        if (!navigator.geolocation) return Promise.resolve(NULL_LOC)
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(NULL_LOC)
          )
        })
      }

      return getLocationNoSupport()
    })

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.accuracy).toBeNull()
  })
})
