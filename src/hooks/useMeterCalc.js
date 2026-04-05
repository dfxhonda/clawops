// ============================================
// useMeterCalc: メーター差分計算の共通ロジック
// MainInput / BoothInput / PatrolInput で同じ計算
// ============================================
import { parseNum } from '../services/utils'

/**
 * メーター差分と異常値検出を計算する純粋関数
 *
 * @param {Object} opts
 * @param {number|string|null} opts.prevIn  - 前回INメーター値
 * @param {number|string|null} opts.prevOut - 前回OUTメーター値
 * @param {number|string|null} opts.inVal   - 今回INメーター入力値
 * @param {number|string|null} opts.outVal  - 今回OUTメーター入力値
 * @param {number} opts.price - 1プレイ料金
 * @returns {Object} 計算結果
 */
export function calcMeterStats({ prevIn, prevOut, inVal, outVal, price = 100 }) {
  const pIn  = prevIn  !== null && prevIn  !== '' ? parseNum(prevIn)  : null
  const pOut = prevOut !== null && prevOut !== '' ? parseNum(prevOut) : null
  const cIn  = inVal   !== null && inVal   !== '' ? parseNum(inVal)  : null
  const cOut = outVal  !== null && outVal  !== '' ? parseNum(outVal) : null

  const inDiff  = cIn !== null && pIn !== null ? cIn - pIn   : null
  const outDiff = cOut !== null && pOut !== null ? cOut - pOut : null

  const inAbnormal  = inDiff !== null && (inDiff < 0 || inDiff > 50000)
  const outAbnormal = outDiff !== null && outDiff < 0

  const sales = inDiff !== null && inDiff >= 0 ? inDiff * price : null
  const payoutRate = outDiff !== null && inDiff !== null && inDiff > 0
    ? ((outDiff / inDiff) * 100).toFixed(1)
    : null

  return { inDiff, outDiff, inAbnormal, outAbnormal, sales, payoutRate, price }
}
