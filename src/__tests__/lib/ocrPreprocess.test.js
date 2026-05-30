import { describe, it, expect } from 'vitest'
import {
  computeCenterCrop,
  otsuThreshold,
  buildHistogramFromGrayscalePixels,
  preprocessForOcr,
  DEFAULT_CROP_RATIO_X,
  DEFAULT_CROP_RATIO_Y,
} from '../../lib/ocrPreprocess'

describe('computeCenterCrop', () => {
  it('既定比率(0.9 x 0.45)で1280x720を中央クロップする', () => {
    const r = computeCenterCrop(1280, 720)
    expect(r.sw).toBe(1152) // 1280 * 0.9
    expect(r.sh).toBe(324)  // 720 * 0.45
    expect(r.sx).toBe(64)   // (1280-1152)/2
    expect(r.sy).toBe(198)  // (720-324)/2
  })

  it('比率指定で任意サイズが取れる', () => {
    const r = computeCenterCrop(1000, 1000, 0.5, 0.5)
    expect(r).toEqual({ sx: 250, sy: 250, sw: 500, sh: 500 })
  })

  it('小さい画像でも0以上の値を返す', () => {
    const r = computeCenterCrop(10, 10, 0.9, 0.45)
    expect(r.sw).toBeGreaterThan(0)
    expect(r.sh).toBeGreaterThan(0)
    expect(r.sx).toBeGreaterThanOrEqual(0)
    expect(r.sy).toBeGreaterThanOrEqual(0)
  })

  it('既定値が公開されている', () => {
    expect(DEFAULT_CROP_RATIO_X).toBe(0.9)
    expect(DEFAULT_CROP_RATIO_Y).toBe(0.45)
  })
})

describe('otsuThreshold', () => {
  it('明確な双峰ヒストグラムで2峰の間に閾値が来る', () => {
    const hist = new Array(256).fill(0)
    for (let i = 30; i < 60; i++) hist[i] = 100
    for (let i = 200; i < 230; i++) hist[i] = 100
    const t = otsuThreshold(hist)
    expect(t).toBeGreaterThanOrEqual(59)
    expect(t).toBeLessThanOrEqual(200)
  })

  it('単峰（フラット）でも例外を投げず妥当な値を返す', () => {
    const hist = new Array(256).fill(1)
    const t = otsuThreshold(hist)
    expect(t).toBeGreaterThanOrEqual(0)
    expect(t).toBeLessThanOrEqual(255)
  })

  it('全画素が0なら128（フォールバック）を返す', () => {
    const hist = new Array(256).fill(0)
    expect(otsuThreshold(hist)).toBe(128)
  })

  it('暗側画素が大半でも明側との境界を返す', () => {
    const hist = new Array(256).fill(0)
    hist[20] = 1000
    hist[220] = 50
    const t = otsuThreshold(hist)
    expect(t).toBeGreaterThanOrEqual(20)
    expect(t).toBeLessThan(220)
  })
})

describe('buildHistogramFromGrayscalePixels', () => {
  it('RGBAバッファから輝度ヒストグラムを作る', () => {
    const data = new Uint8ClampedArray([
      10, 10, 10, 255,
      10, 10, 10, 255,
      200, 200, 200, 255,
    ])
    const hist = buildHistogramFromGrayscalePixels(data)
    expect(hist[10]).toBe(2)
    expect(hist[200]).toBe(1)
    expect(hist).toHaveLength(256)
  })
})

describe('preprocessForOcr', () => {
  // J-PATROL-99_adhoc_preprocess_grayscale_no_binarize-fix-06 (2026-05-30 ヒロFB):
  // default は grayscale + コントラスト伸長止まり (中間グレー保持)。
  // 旧テスト「二値化を適用する」は { binarize: true } 明示で従来挙動を担保する。
  it('binarize=true: グレースケール → コントラスト伸長 → 二値化 を適用する', () => {
    const data = new Uint8ClampedArray([
      // R, G, B, A
      50, 50, 50, 255,    // dark
      200, 200, 200, 255, // bright
      120, 120, 120, 255, // mid
      30, 30, 30, 255,    // dark
      230, 230, 230, 255, // bright
    ])
    const t = preprocessForOcr(data, { binarize: true })
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(255)

    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1])
      expect(data[i + 1]).toBe(data[i + 2])
      expect([0, 255]).toContain(data[i])
    }

    expect(data[0]).toBe(0)
    expect(data[4]).toBe(255)
    expect(data[12]).toBe(0)
    expect(data[16]).toBe(255)
  })

  it('binarize=true: カラー画像でも輝度係数で正しく処理する', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
    ])
    preprocessForOcr(data, { binarize: true })
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
    }
  })

  it('default (二値化なし + S字ブースト factor=1.8): grayscale + 強コントラストで中間グレーが残る (ヒロ要件 fix-06+08)', () => {
    const data = new Uint8ClampedArray([
      50, 50, 50, 255,
      200, 200, 200, 255,
      120, 120, 120, 255,
      30, 30, 30, 255,
      230, 230, 230, 255,
    ])
    const t = preprocessForOcr(data) // binarize 省略 = false, contrastFactor=1.8 default
    expect(t).toBeNull() // 二値化していないので閾値は null
    // 全ピクセルが grayscale (R==G==B) 化されている
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1])
      expect(data[i + 1]).toBe(data[i + 2])
    }
    // 端点: 元 30 → 0、元 230 → 255 (線形伸長で確定、S 字でも変わらず)
    expect(data[12]).toBe(0)
    expect(data[16]).toBe(255)
    // 中間値 (元 120) は 0 でも 255 でもなく中間グレーになる (S 字ブースト後も)
    const mid = data[8]
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(255)
  })

  it('contrastFactor=1.0 (S字無効): 線形伸長のみで中間値の押し付けなし (fix-08 制御確認)', () => {
    const data = new Uint8ClampedArray([
      30, 30, 30, 255,
      120, 120, 120, 255,
      230, 230, 230, 255,
    ])
    preprocessForOcr(data, { contrastFactor: 1.0 })
    // 元 120 → 線形伸長 (120-30)/200 * 255 ≈ 114.75 → 115
    // S 字 factor=1.0 なら変更なし → 115 のまま
    expect(data[4]).toBe(115)
  })

  it('contrastFactor=1.8 (default 想定): S字ブーストで中間が暗い方に押される (fix-08)', () => {
    const data = new Uint8ClampedArray([
      30, 30, 30, 255,
      120, 120, 120, 255,
      230, 230, 230, 255,
    ])
    preprocessForOcr(data, { contrastFactor: 1.8 })
    // 元 120 → 線形伸長 115 → S 字 (115-128)*1.8+128 = -23.4+128 = 104.6 → 105
    expect(data[4]).toBe(105)
  })
})
