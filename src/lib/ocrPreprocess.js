// OCR 前処理ユーティリティ
//
// 目的:
//   1. 撮影画像から固定枠で中央クロップして OCR ノイズを削減する
//   2. クロップ後画像に grayscale + コントラスト伸長 + Otsu 自動二値化を適用して
//      照明条件に依存しない安定した白黒画像にする
//
// すべて純粋関数で、テスト容易性を保つ。

// 既定のクロップ比率（画面中央 90% × 45%、横長メーターに合わせた値）
export const DEFAULT_CROP_RATIO_X = 0.9
export const DEFAULT_CROP_RATIO_Y = 0.45

/**
 * 画面中央のクロップ領域を計算する。
 * @param {number} srcWidth  元画像幅（px）
 * @param {number} srcHeight 元画像高さ（px）
 * @param {number} ratioX    幅比率 (0–1)
 * @param {number} ratioY    高さ比率 (0–1)
 * @returns {{sx:number, sy:number, sw:number, sh:number}}
 */
export function computeCenterCrop(
  srcWidth,
  srcHeight,
  ratioX = DEFAULT_CROP_RATIO_X,
  ratioY = DEFAULT_CROP_RATIO_Y,
) {
  const sw = Math.max(1, Math.floor(srcWidth * ratioX))
  const sh = Math.max(1, Math.floor(srcHeight * ratioY))
  const sx = Math.max(0, Math.floor((srcWidth - sw) / 2))
  const sy = Math.max(0, Math.floor((srcHeight - sh) / 2))
  return { sx, sy, sw, sh }
}

/**
 * 256bin の輝度ヒストグラムから Otsu の最適閾値を求める。
 * クラス間分散最大化アルゴリズム。
 * @param {ArrayLike<number>} histogram 長さ256の各輝度の画素数
 * @returns {number} 0–255 の閾値
 */
export function otsuThreshold(histogram) {
  let total = 0
  for (let i = 0; i < 256; i++) total += histogram[i] || 0
  if (total === 0) return 128

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * (histogram[i] || 0)

  let sumB = 0
  let wB = 0
  let maxVar = -1
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += histogram[t] || 0
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * (histogram[t] || 0)
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > maxVar) {
      maxVar = between
      threshold = t
    }
  }
  return threshold
}

/**
 * グレースケール後の RGBA バッファから 256bin ヒストグラムを構築する。
 * R=G=B 前提（grayscale 後に呼ぶこと）。
 * @param {Uint8ClampedArray|Uint8Array} data RGBA 連続バッファ
 * @returns {number[]} length 256
 */
export function buildHistogramFromGrayscalePixels(data) {
  const hist = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]]++
  }
  return hist
}

/**
 * RGBA バッファに対して以下を適用する (in-place):
 *   1) grayscale (全チャンネル均等平均 (R+G+B)/3)
 *   2) コントラスト線形伸長 (min→0, max→255)
 *   3) S 字コントラストブースト (contrastFactor !== 1 のとき、中点=midpoint)
 *   4) posterize (posterizeLevels >= 2 のとき、N 段量子化)
 *   5) (binarize=true のとき) Otsu 自動二値化
 *
 * J-PATROL-99 fix-06: 二値化を default 解除。
 * J-PATROL-99 fix-08: S 字ブースト追加。
 * J-PATROL-99 fix-09 (2026-05-30): posterize 追加。
 * J-PATROL-99 fix-10 (2026-05-30): contrastFactor=1.8, posterize=4。
 * SPEC-OCR-PREPROCESS-GRAY-EQUALIZE-01 (2026-06-13):
 *   grayscale を ITU-R BT.601 ルマ係数 → (R+G+B)/3 均等平均に変更。
 *   青紫 LED 照明で B=0.114 により数字画素が暗く飛ぶ照明色依存ムラを解消。
 *   posterizeLevels default 4→0 (段階化無効)。
 *   contrastFactor default 1.8→1.3 (過剰コントラスト化を抑制)。
 *   midpoint 引数追加 default=80 (中点を白側に寄せ薄文字を拾いやすくする)。
 *
 * @param {Uint8ClampedArray|Uint8Array} data RGBA 連続バッファ
 * @param {{ binarize?: boolean, contrastFactor?: number, posterizeLevels?: number, midpoint?: number }} options
 * @returns {number|null} binarize=true 時は採用された Otsu 閾値、それ以外は null
 */
export function preprocessForOcr(data, options = {}) {
  const { binarize = false, contrastFactor = 1.3, posterizeLevels = 0, midpoint = 80 } = options
  // 全チャンネル均等平均: 青紫LED照明でも色依存ムラなし (旧: ITU-R BT.601 ルマ係数)
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)
    data[i] = data[i + 1] = data[i + 2] = gray
  }

  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < min) min = data[i]
    if (data[i] > max) max = data[i]
  }
  const range = max - min || 1
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(((data[i] - min) / range) * 255)
    data[i] = data[i + 1] = data[i + 2] = v
  }

  // fix-08: S 字コントラストブースト。factor=1.0 は no-op、factor>1 は強コントラスト化。
  // GRAY-EQUALIZE-01 C3: midpoint 引数で中点を指定可能 (default=100)。
  if (contrastFactor !== 1) {
    for (let i = 0; i < data.length; i += 4) {
      const boosted = (data[i] - midpoint) * contrastFactor + midpoint
      const v = boosted < 0 ? 0 : boosted > 255 ? 255 : Math.round(boosted)
      data[i] = data[i + 1] = data[i + 2] = v
    }
  }

  // fix-09: posterize (N 段量子化)。posterizeLevels >= 2 で N トーンに丸める。
  // 例: N=4 → 0/85/170/255、N=6 → 0/51/102/153/204/255。
  // bucket: floor(v / 256 * N)。段の中心値: round(bucket * 255 / (N-1))。
  if (posterizeLevels >= 2) {
    const N = Math.floor(posterizeLevels)
    const step = 256 / N
    for (let i = 0; i < data.length; i += 4) {
      const bucket = Math.min(N - 1, Math.floor(data[i] / step))
      const quantized = Math.round((bucket * 255) / (N - 1))
      data[i] = data[i + 1] = data[i + 2] = quantized
    }
  }

  if (!binarize) return null

  const hist = buildHistogramFromGrayscalePixels(data)
  const t = otsuThreshold(hist)
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] >= t ? 255 : 0
    data[i] = data[i + 1] = data[i + 2] = v
  }
  return t
}
