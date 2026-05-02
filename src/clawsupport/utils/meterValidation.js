/**
 * OCR結果と前回値を比較して警告リストを返す
 * @param {object} ocr - Edge Functionのレスポンス { machine_code, meters, confidence }
 * @param {object|null} prev - 前回のmeter_readings（nullなら初回）
 * @param {boolean} is2Booth - 2ブース機かどうか
 * @returns {{ valid: boolean, warnings: string[], blocked: boolean }}
 */
export function validateMeterReading(ocr, prev, is2Booth) {
  const warnings = []
  let blocked = false
  const m = ocr?.meters || {}

  if (!ocr?.machine_code) {
    warnings.push('機械コードが読み取れませんでした')
  }

  if (is2Booth) {
    // 前回比チェック
    if (prev && m.left_in != null && prev.left_in != null && m.left_in < prev.left_in) {
      warnings.push('左側INが前回より減少しています')
    }
    if (prev && m.right_in != null && prev.right_in != null && m.right_in < prev.right_in) {
      warnings.push('右側INが前回より減少しています')
    }
    // IN < OUT チェック
    if (m.left_in != null && m.left_out != null && m.left_in < m.left_out) {
      warnings.push('左側: IN < OUT（異常値）')
      blocked = true
    }
    if (m.right_in != null && m.right_out != null && m.right_in < m.right_out) {
      warnings.push('右側: IN < OUT（異常値）')
      blocked = true
    }
    // null チェック
    const nullFields = ['left_in', 'left_out', 'right_in', 'right_out'].filter(k => m[k] == null)
    if (nullFields.length > 0) {
      warnings.push(`読み取り失敗: ${nullFields.join(', ')}`)
    }
  } else {
    if (prev && m.in_meter != null && prev.in_meter != null && m.in_meter < prev.in_meter) {
      warnings.push('INが前回より減少しています')
    }
    if (m.in_meter != null && m.out_meter != null && m.in_meter < m.out_meter) {
      warnings.push('IN < OUT（異常値）')
      blocked = true
    }
    const nullFields = ['in_meter', 'out_meter'].filter(k => m[k] == null)
    if (nullFields.length > 0) {
      warnings.push(`読み取り失敗: ${nullFields.join(', ')}`)
    }
  }

  if (ocr?.confidence != null && ocr.confidence < 0.8) {
    warnings.push(`信頼度が低い（${ocr.confidence.toFixed(2)}）。再撮影推奨`)
  }

  return { valid: warnings.length === 0, warnings, blocked }
}

/** 2ブース機かどうかを machine_type_guess から判定 */
export function is2BoothType(machineTypeGuess) {
  return ['BUZZ_CRANE_4', 'BUZZ_CRANE_SLIM', 'SESAME_W', 'TRI_DECK'].includes(machineTypeGuess)
}
