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

  it('binarize=true: カラー画像(RGB原色)でも均等グレースケールで正しく処理する', () => {
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

  // AC2: default posterizeLevels=0 → 量子化なし → 連続グレー保持
  it('default (GRAY-EQUALIZE-01: contrastFactor=1.3 + posterizeLevels=0): 連続グレーが保たれる', () => {
    const data = new Uint8ClampedArray([
      50, 50, 50, 255,
      200, 200, 200, 255,
      120, 120, 120, 255,
      30, 30, 30, 255,
      230, 230, 230, 255,
    ])
    const t = preprocessForOcr(data) // new default: binarize=false, contrastFactor=1.3, posterizeLevels=0, midpoint=100
    expect(t).toBeNull()
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1])
      expect(data[i + 1]).toBe(data[i + 2])
    }
    // 中間画素 (120,120,120): 伸長→115, S字(1.3,midpoint=100)→(115-100)*1.3+100=119.5→120
    // 量子化されず 120 になること (旧デフォルト4値なら 85 or 170 だった)
    expect(data[8]).toBe(120)
    expect([0, 85, 170, 255]).not.toContain(data[8])
  })

  it('posterizeLevels=0 + contrastFactor=1 (両方無効): 線形伸長のみで連続グレーが残る', () => {
    const data = new Uint8ClampedArray([
      30, 30, 30, 255,
      120, 120, 120, 255,
      230, 230, 230, 255,
    ])
    preprocessForOcr(data, { posterizeLevels: 0, contrastFactor: 1.0 })
    // 元 120 → 線形伸長 (120-30)/200 * 255 ≈ 114.75 → 115
    expect(data[4]).toBe(115)
  })

  it('posterizeLevels=6: 6 段量子化で 0/51/102/153/204/255 のどれかに丸まる', () => {
    const data = new Uint8ClampedArray([
      30, 30, 30, 255,
      80, 80, 80, 255,
      130, 130, 130, 255,
      180, 180, 180, 255,
      230, 230, 230, 255,
    ])
    preprocessForOcr(data, { posterizeLevels: 6 })
    const allowed = [0, 51, 102, 153, 204, 255]
    for (let i = 0; i < data.length; i += 4) {
      expect(allowed).toContain(data[i])
    }
  })

  it('posterizeLevels=2: 2 段量子化で 0/255 になる (Otsu binarize なしで純2値)', () => {
    const data = new Uint8ClampedArray([
      30, 30, 30, 255,
      120, 120, 120, 255,
      230, 230, 230, 255,
    ])
    preprocessForOcr(data, { posterizeLevels: 2 })
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
    }
  })

  it('contrastFactor=1.8 + posterizeLevels=0 + midpoint=128 (旧 fix-08 挙動): S字のみ、中間が暗側に押される', () => {
    const data = new Uint8ClampedArray([
      30, 30, 30, 255,
      120, 120, 120, 255,
      230, 230, 230, 255,
    ])
    preprocessForOcr(data, { contrastFactor: 1.8, posterizeLevels: 0, midpoint: 128 })
    // 元 120 → 線形伸長 115 → S字 (115-128)*1.8+128 = 104.6 → 105
    expect(data[4]).toBe(105)
  })

  // AC1 (SPEC-OCR-PREPROCESS-GRAY-EQUALIZE-01): 均等グレースケール検証
  it('AC1-均等グレースケール: 青単色(0,0,255)がグレー85になる (旧ルマ係数なら29)', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,       // black → gray=0 (伸長アンカー min)
      0, 0, 255, 255,     // blue → (0+0+255)/3=85
      255, 255, 255, 255, // white → gray=255 (伸長アンカー max)
    ])
    // contrastFactor=1 → S字スキップ。min=0,max=255 → 伸長は恒等。
    preprocessForOcr(data, { contrastFactor: 1, posterizeLevels: 0 })
    expect(data[4]).toBe(85) // 旧 ITU-R BT.601: Math.round(0.114*255)=29
  })

  // AC3 (SPEC-OCR-PREPROCESS-GRAY-EQUALIZE-01): midpoint=100 でS字の中点が100
  it('AC3-midpoint100: S字の中点が100で127グレーが明側へシフトする', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      127, 127, 127, 255,
      255, 255, 255, 255,
    ])
    // posterizeLevels=0, default midpoint=100, default contrastFactor=1.3
    preprocessForOcr(data, { posterizeLevels: 0 })
    // 伸長: min=0,max=255 → 恒等。S字(1.3, midpoint=100): (127-100)*1.3+100=135.1→135
    expect(data[4]).toBe(135)
  })
})
