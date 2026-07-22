// SPEC-MAIL-IMPORT-ENGINE-01 (D-090): 汎用メール取込ルールエンジン (ruleEngine.ts) の純関数検証。
// mail_sampling_raw の実メール本文を fixture に使い H1-H8 + dedup を検証する。
import { describe, it, expect } from 'vitest'
import {
  parseAnnouncements,
  isAnnouncement,
  dedupKey,
  filterNewAnnouncements,
} from '../../../supabase/functions/mail-import/ruleEngine.ts'

// INF ルール (mail_import_rules id=1) を H4 に更新した形: name_marker_regex=[]、marker_strip_regex 新設、
// field_regex.prize_name_markers 削除 (DB行更新は chat 側だが、テストは H4後の形で意図を証明する)。
const INF_RULE = {
  supplier_id: 'INF',
  from_pattern: 'inf_main@8infinity\\.jp',
  is_announcement_rule: { require_image: true, forbid_attachment_regex: '請書.*\\.xlsx?$' },
  name_marker_regex: [],
  marker_strip_regex: '^[★☆●○◎◆◇■□▲△▼▽・\\-*＊]+\\s*',
  exclude_line_regex: [
    '^\\s*$', 'カタログ', '掲載(禁止|NG)', '販売\\s*NG', '様(への)?案内(は)?(NG|不可)',
    'ご発注(書)?先着', 'INFINITY', '株式会社インフィニティ', '^・', 'ゼロ回答', '減数',
  ],
  field_regex: {
    unit_cost: '[＠@]\\s*([0-9０-９][0-9０-９,，]{2,})',
    case_quantity: '([0-9０-９]+)\\s*(?:入|個単位|枚単位|個|足)',
    half_to_notes: 'ハーフ[\\s]*(不可|可|送料[0-9０-９]+)',
    joushin_to_notes: '上代[\\s￥¥\\\\]*[0-9０-９,，]+',
    delivery_to_notes: '([0-9０-９]{1,2}[／/][0-9０-９]{1,2}\\s*締|[0-9０-９]{1,2}月[上中下末]|即納|発売|再?入荷)',
  },
  freshness_months: 2,
}

// Fixture A (実メール: "12月入荷●顔でかモンチッチ★キーチェーンミニ")
const FIXTURE_A = [
  '7/23締',
  '12月入荷',
  '',
  '★モンチッチ　キーチェーンミニ2種　',
  '60入　＠770-',
  'ハーフ不可',
  '上代￥1200',
  '',
  '★顔でか　モンチッチ2種',
  '60入　＠940-',
  'ハーフ不可',
  '上代￥1500',
  '',
  '大幅な減数、ゼロ回答の可能性がります。',
].join('\n')

// Fixture B (実メール: "10月発売●サラブレッドコレクション ぬいぐるみBC")
const FIXTURE_B = [
  '■サラブレッドコレクション ぬいぐるみBC　6種',
  '60入　＠1000- ',
  'ハーフ不可',
  '上代 ¥1,800',
  '発売日：10月中下旬',
].join('\n')

describe('AC3/AC4/H4: ●■◆/記号案内を抽出、品名に上代/￥/【/＠が混入しない', () => {
  it('Fixture A: 2案内、マーカー剥がし、単価/入数抽出、上代/ハーフは notes', () => {
    const items = parseAnnouncements(INF_RULE, FIXTURE_A)
    expect(items.length).toBe(2)

    expect(items[0].prize_name).toBe('モンチッチ　キーチェーンミニ2種')
    expect(items[0].unit_cost).toBe(770)
    expect(items[0].case_quantity).toBe(60)
    expect(items[0].supplier_marker).toBe('★')
    expect(items[0].notes).toContain('上代')
    expect(items[0].notes).toContain('1200')
    expect(items[0].notes).toContain('ハーフ不可')

    expect(items[1].prize_name).toBe('顔でか　モンチッチ2種')
    expect(items[1].unit_cost).toBe(940)
    expect(items[1].case_quantity).toBe(60)
    expect(items[1].notes).toContain('1500')

    // AC4: prize_name に 上代 / 【 / ￥ / ＠ が混入していない
    for (const it of items) {
      expect(it.prize_name).not.toMatch(/[上代￥¥【＠@]/)
    }
  })

  it('Fixture B: ■マーカー案内1件、上代/ハーフ/発売日は notes', () => {
    const items = parseAnnouncements(INF_RULE, FIXTURE_B)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('サラブレッドコレクション ぬいぐるみBC　6種')
    expect(items[0].unit_cost).toBe(1000)
    expect(items[0].case_quantity).toBe(60)
    expect(items[0].supplier_marker).toBe('■')
    expect(items[0].notes).toContain('1,800')
    expect(items[0].notes).toContain('ハーフ不可')
    expect(items[0].notes).toContain('10月中下旬')
    expect(items[0].case_cost).toBe(60000) // 1000 * 60
  })
})

describe('H4/field: 全角数字の単価/入数を取りこぼさない (旧 \\d バグ回避)', () => {
  it('全角＠と全角入数を抽出', () => {
    const body = ['●ガチャ全角テスト', '４８入　＠１２００-'].join('\n')
    const items = parseAnnouncements(INF_RULE, body)
    expect(items.length).toBe(1)
    expect(items[0].unit_cost).toBe(1200)
    expect(items[0].case_quantity).toBe(48)
  })
})

describe('H2: 【】3分岐 (B1 行頭key=値採用 / B2 品名内は外して notes / B3 単独は notes)', () => {
  it('B2 品名内【】は外れて notes、prize_name に【】が残らない', () => {
    const body = ['●NICIグレムリン【ギズモ】キーリング', '72個単位　＠700-'].join('\n')
    const items = parseAnnouncements(INF_RULE, body)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('NICIグレムリンキーリング')
    expect(items[0].prize_name).not.toContain('【')
    expect(items[0].notes).toContain('【ギズモ】')
    expect(items[0].case_quantity).toBe(72)
  })
})

describe('AC6/dedup: 同一メール内の同名衝突で件数が減らない (行番号キー)', () => {
  it('B2 でキャラ名が落ち同名になっても両方残る', () => {
    const body = [
      '●NICIグレムリン【ギズモ】キーリング',
      '72個単位　＠700-',
      '',
      '●NICIグレムリン【ストライプ】キーリング',
      '72個単位　＠700-',
    ].join('\n')
    const items = parseAnnouncements(INF_RULE, body)
    expect(items.length).toBe(2)
    // 品名は同一 (キャラ名が落ちた)
    expect(items[0].prize_name).toBe(items[1].prize_name)
    // 行番号が違うので dedup キーは別
    expect(items[0].line_number).not.toBe(items[1].line_number)
    const fresh = filterNewAnnouncements(items, 'MSG1', [])
    expect(fresh.length).toBe(2) // 同名でも両方残る
    // 従来キー(source_ref+prize_name)なら1件に潰れていたことの対比
    const keyA = dedupKey('MSG1', items[0].prize_name, items[0].line_number)
    const keyB = dedupKey('MSG1', items[1].prize_name, items[1].line_number)
    expect(keyA).not.toBe(keyB)
  })

  it('既存キーに一致するものは除外される (再取込は追加のみ)', () => {
    const items = parseAnnouncements(INF_RULE, FIXTURE_A)
    const existing = [dedupKey('MSG1', items[0].prize_name, items[0].line_number)]
    const fresh = filterNewAnnouncements(items, 'MSG1', existing)
    expect(fresh.length).toBe(1)
    expect(fresh[0].prize_name).toBe(items[1].prize_name)
  })
})

describe('AC7/is_announcement: 受書xlsx付き/画像なしは案内でない', () => {
  it('請書xlsx添付 → 案内でない', () => {
    expect(isAnnouncement(INF_RULE, { hasImage: true, attachmentNames: ['請書_2026.xlsx'] })).toBe(false)
  })
  it('画像なし → 案内でない', () => {
    expect(isAnnouncement(INF_RULE, { hasImage: false, attachmentNames: [] })).toBe(false)
  })
  it('画像あり・禁止添付なし → 案内', () => {
    expect(isAnnouncement(INF_RULE, { hasImage: true, attachmentNames: ['photo.jpg'] })).toBe(true)
  })
})
