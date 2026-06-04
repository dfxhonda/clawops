import { supabase } from './supabase'

const ABBREV = {
  'ぬいぐるみ': 'NG',
  'マスコット': 'MC',
  'ボールチェーン': 'BC',
  'キーホルダー': 'KH',
  'キーケース': 'KC',
  'スクイーズ': 'SQ',
  'ワイヤレスイヤホン': 'TWS',
  'ブレスレット': 'BLT',
  'ミニゲーム機': 'MNGM',
  'スマートウォッチ': 'SW',
  'モバイルバッテリー': 'MBT',
  'コントローラー': 'CTRL',
  'クッション': 'CSHN',
  'ブランケット': 'BLKT',
  'スピーカー': 'SPK',
  'フラッシュボタン': 'FLBT',
  'ダストBOX': 'DTBX',
  'ジャグラー': 'ジャグ',
  'ディズニー': 'DN',
  'アソート': 'AS',
}

function applyAbbrev(name) {
  let result = name
  for (const [k, v] of Object.entries(ABBREV)) {
    result = result.replaceAll(k, v)
  }
  return result
}

function stripSize(name) {
  return name
    .replace(/\s*約?\d+(\.\d+)?[xX×]\d+(\.\d+)?(cm|mm)?\s*/g, ' ')
    .replace(/\s*約?\d+(\.\d+)?(cm|mm)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function generateShortName(prizeName) {
  if (!prizeName) return ''
  const intermediate = applyAbbrev(stripSize(prizeName))
  if (intermediate.length <= 15) return intermediate

  try {
    const { data, error } = await supabase.functions.invoke('shorten-prize-name', {
      body: { prize_name: intermediate },
    })
    if (!error && data?.short_name && typeof data.short_name === 'string') {
      return data.short_name.slice(0, 15)
    }
  } catch {
    // fallthrough to fallback
  }
  return intermediate.slice(0, 15)
}
