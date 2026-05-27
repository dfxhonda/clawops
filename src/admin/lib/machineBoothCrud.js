// J-ADMIN-MACHINE-BOOTH-CRUD-01
// 機械/ブースの自動採番ロジック (純関数)。
// 実データ確認: machines = {store_code}-M{NN} (2桁ゼロ埋め, 例 KOS01-M11),
//               booths   = {machine_code}-B{NN} (2桁ゼロ埋め, 例 KKY01-M03-B02)

function maxSuffix(codes, prefix, sep) {
  // prefix + sep + 数字 にマッチする末尾番号の最大値を返す (該当なし=0)
  const re = new RegExp(`^${escapeRe(prefix)}${escapeRe(sep)}(\\d+)$`)
  let max = 0
  for (const c of codes ?? []) {
    const m = typeof c === 'string' && c.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return max
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const pad2 = n => String(n).padStart(2, '0')

/** 次の機械コード: {storeCode}-M{NN} */
export function nextMachineCode(storeCode, existingMachineCodes) {
  const next = maxSuffix(existingMachineCodes, storeCode, '-M') + 1
  return `${storeCode}-M${pad2(next)}`
}

/** 次のブースコード: {machineCode}-B{NN} */
export function nextBoothCode(machineCode, existingBoothCodes) {
  const next = maxSuffix(existingBoothCodes, machineCode, '-B') + 1
  return `${machineCode}-B${pad2(next)}`
}

/** 次の booth_number: 既存最大 + 1 (なし=1) */
export function nextBoothNumber(booths) {
  let max = 0
  for (const b of booths ?? []) {
    const n = Number(b?.booth_number)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}
