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
  it('グレースケール → コントラスト伸長 → 二値化 を適用する', () => {
    const data = new Uint8ClampedArray([
      // R, G, B, A
      50, 50, 50, 255,    // dark
      200, 200, 200, 255, // bright
      120, 120, 120, 255, // mid
      30, 30, 30, 255,    // dark
      230, 230, 230, 255, // bright
    ])
    const t = preprocessForOcr(data)
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

  it('カラー画像でも輝度係数で正しく処理する', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
    ])
    preprocessForOcr(data)
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
    }
  })
})
