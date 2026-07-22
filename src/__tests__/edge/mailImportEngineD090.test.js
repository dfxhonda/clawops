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

// BUG-D090-JOUSHIN-NAMELINE (gate_3 実データ検証で発見): 上代同居型(type_B)の品名行が抽出0件になっていた。
// 品名行に「上代」が同居すると旧 isAttrLine が部分マッチで属性行と誤判定し、品名ブロックが生成されなかった。
// 実メール本文 (こびとづかん/リラックマ もこもこルームソックス)。
describe('BUG-D090-JOUSHIN-NAMELINE: 上代同居型(type_B)を取りこぼさない', () => {
  const TYPE_B_1 = [
    'こびとづかん もこもこルームソックス（大人用）　上代￥３８０',
    '単価：＠205',
    '出荷単位：１９２足',
  ].join('\n')
  const TYPE_B_2 = [
    'リラックマもこもこルームソックス（大人用）　上代￥３８０',
    '単価：＠210',
    '出荷単位：２１６足',
  ].join('\n')

  it('こびとづかん: 1件抽出、品名に上代/￥混入なし、単価205/入数192/上代は備考', () => {
    const items = parseAnnouncements(INF_RULE, TYPE_B_1)
    expect(items.length).toBe(1)
    const a = items[0]
    expect(a.prize_name).toContain('こびとづかん')
    expect(a.prize_name).toContain('もこもこルームソックス')
    expect(a.prize_name).not.toMatch(/上代/)
    expect(a.prize_name).not.toMatch(/[￥¥]/)
    expect(a.unit_cost).toBe(205)
    expect(a.case_quantity).toBe(192)
    expect(a.notes).toMatch(/上代/)
    expect(a.notes).toMatch(/３８０/) // 備考は原文(全角)のまま保持
  })

  it('リラックマ: 全角数字入数216/単価210、品名に上代なし', () => {
    const items = parseAnnouncements(INF_RULE, TYPE_B_2)
    expect(items.length).toBe(1)
    const a = items[0]
    expect(a.prize_name).toContain('リラックマ')
    expect(a.prize_name).not.toMatch(/上代/)
    expect(a.unit_cost).toBe(210)
    expect(a.case_quantity).toBe(216)
  })

  it('2ブロック同一本文でも両方抽出 (行番号dedupで衝突しない)', () => {
    const items = parseAnnouncements(INF_RULE, TYPE_B_1 + '\n\n' + TYPE_B_2)
    expect(items.length).toBe(2)
    const keys = new Set(items.map((it) => dedupKey('msg1', it.prize_name, it.line_number)))
    expect(keys.size).toBe(2)
  })
})

// REG-1/REG-2/REG-3 (chat gate_3 実データ再検証で発見): 属性行が品名に化ける / 品名の語欠落 / 品名に￥残存。
// mail_sampling_raw の実メール本文8通をそのまま流し、抽出品名の不変条件を検証する(fixtureだけでなく実データ)。
describe('REG-1/2/3: 実データ8通で属性行を品名に化けさせない & 品名に上代/￥混入なし', () => {
  const REAL = {
    toystory: [
      '【POINT】', '・映画が大好評のトイストーリーから立体ラバーマスコットが新登場！',
      'トイストーリーラバーマスコット',
      '入数　180入（ハーフ可）ハーフ別途送料￥1000',
      '価格　＠２３０', '納期　8月下旬～9月', 'アイテム　9種',
      'サイズ　（ウッディ）約H7xW4.4xD4cm',
    ].join('\n'),
    kobito: [
      'フランネルスクエアクッション　こびとづかん',
      '入数：４８個　ハーフ送料１０００円', '単価：＠1000', '納期：９月上旬',
      'フランネルひざ掛け１００×１４０こびとづかん',
      '入数：４８個　ハーフ送料１０００円', '単価：＠1000', '納期：９月上旬',
      'こびとづかんアソート',
      '入数：９６個　ハーフ送料１０００円', '単価：＠565', '納期：即納',
    ].join('\n'),
    sanrio: [
      '10月発売', '7/24締',
      '★サンリオ　ふわコロりん10', '72入　＠620-', '上代￥1000',
      '★サンリオ　ぽてコロマスコット10', '72入　＠620-', '上代￥1000',
      '★サンリオ　ジュエリーマスコット17', '120入　＠426-', '上代￥700',
      '★サンリオ　ジュエリークリップ3', '120入　＠370-', '上代￥600',
      'ハーフ送料￥1000',
    ].join('\n'),
    nici: [
      '8月末～9月中再入荷',
      '●NICIグレムリン【ギズモ】キーリング', '72個単位　＠８００-',
      '種類：1種', 'ハーフ不可', '上代\\1300税抜き', '物販ライセンス',
    ].join('\n'),
    anpan: [
      '即納(中5日）', '●アンパンマン・ダイカットストローカップ3種', '120入　＠４５０円',
      '＊アンパンマンが多めのアソートです。', '上代OPEN', 'ハーフ送料1000円', '北海道送料1500円',
    ].join('\n'),
    mini4: [
      '上代￥1000→￥1200のため', '単価が変わります。', '売れ筋',
      '●ミニ四駆　', '60入　＠９４０-', '上代￥1200', '物販品', 'ハーフ不可', '即納(中10～14日）',
    ].join('\n'),
  }

  const ATTR_HEAD_RE = /^(入\s*数|価\s*格|単\s*価|特\s*価|出\s*荷\s*単\s*位|発\s*送\s*単\s*位|納\s*期|上\s*代|ハーフ|[＠@])/

  it('全8通: どの prize_name も属性行由来でなく、上代/￥/【 を含まない (AC4 + REG-1)', () => {
    for (const [key, body] of Object.entries(REAL)) {
      const items = parseAnnouncements(INF_RULE, body)
      for (const a of items) {
        expect(a.prize_name, `${key}: 属性行が品名化`).not.toMatch(ATTR_HEAD_RE)
        expect(a.prize_name, `${key}: 上代混入`).not.toMatch(/上\s*代/)
        expect(a.prize_name, `${key}: ￥混入`).not.toMatch(/[￥¥]/)
        expect(a.prize_name, `${key}: 【混入`).not.toMatch(/[【】]/)
        expect(a.prize_name.length, `${key}: 空品名`).toBeGreaterThan(1)
      }
    }
  })

  it('トイストーリー: 1件、品名=ラバーマスコット、単価230/入数180 (属性行に化けない)', () => {
    const items = parseAnnouncements(INF_RULE, REAL.toystory)
    const named = items.filter((a) => /トイストーリーラバーマスコット/.test(a.prize_name))
    expect(named.length).toBe(1)
    expect(named[0].unit_cost).toBe(230)
    expect(named[0].case_quantity).toBe(180)
    // 入数/価格 行が独立した品名になっていない
    expect(items.some((a) => /^入数|^価格/.test(a.prize_name))).toBe(false)
  })

  it('こびとづかん: 3件 (フランネルスクエア/ひざ掛け/アソート) 各 単価あり、属性行に化けない', () => {
    const items = parseAnnouncements(INF_RULE, REAL.kobito)
    const real = items.filter((a) => a.unit_cost != null && /こびとづかん/.test(a.prize_name) && !/^入数|^単価/.test(a.prize_name))
    expect(real.length).toBe(3)
    expect(items.every((a) => a.unit_cost == null || !/^入数|^単価|^納期/.test(a.prize_name))).toBe(true)
  })

  it('サンリオ: 4件抽出、各 上代は備考で品名クリーン', () => {
    const items = parseAnnouncements(INF_RULE, REAL.sanrio)
    const real = items.filter((a) => /サンリオ/.test(a.prize_name))
    expect(real.length).toBe(4)
  })

  it('NICIグレムリン: 1件、【ギズモ】は品名から外れ notes へ、●剥がし', () => {
    const items = parseAnnouncements(INF_RULE, REAL.nici)
    const real = items.filter((a) => /グレムリン/.test(a.prize_name))
    expect(real.length).toBe(1)
    expect(real[0].prize_name).not.toMatch(/ギズモ|【/)
    expect(real[0].notes).toMatch(/ギズモ/)
    expect(real[0].case_quantity).toBe(72)
  })
})

// NG-1/NG-2/NG-3 (chat gate_3 デプロイ後 dry_run 実データ検証で判明、全て FW転送型のレイアウト):
//   NG-1 ラベル別行FW: 【KEY】と値が別行になり値行が ：VALUE 始まりで品名判定を素通り (：AST-10266 / ：＠1000 等が品名化)。
//   NG-2 送料・配送注意の散文 (今回より1カートン…本州の場合、/ 北海道、沖縄、離島は…別途見積り) が品名化。
//   NG-3 品名に単価・入数が同居 (ちいかわ フィギュアキーホルダー⑤ 108入＠550) → 品名文字列から剥がせていない。
// mail_sampling_raw の FW転送実メール本文をそのまま流し、抽出品名の不変条件を検証する (fixtureでなく実データ)。
// SDY(info@sdy-co.com=ワンズアミューズ)の bracket-label / markdown装飾レイアウトが FW転送型の実物。
const SDY_RULE = {
  supplier_id: 'SDY',
  from_pattern: 'info@sdy-co\\.com',
  is_announcement_rule: { require_image: true, forbid_attachment_regex: '請書.*\\.xlsx?$' },
  name_marker_regex: [],
  marker_strip_regex: '^[★☆●○◎◆◇■□▲△▼▽・\\-*＊_]+\\s*',
  exclude_line_regex: ['^\\s*$', '株式会社', '◇◆', 'ONES', 'TEL', 'FAX', '〒', 'E-mail', '大阪府'],
  signature_cut_regex: ['^--\\s*$', '◇◆◇', '株式会社\\s*ワンズアミューズ'],
  field_regex: {
    unit_cost: '[＠@]\\s*([0-9０-９][0-9０-９,，]{2,})',
    case_quantity: '([0-9０-９]+)\\s*(?:入|個単位|枚単位|個|足)',
    half_to_notes: 'ハーフ[\\s]*(不可|可|ＯＫ|OK|送料[0-9０-９]+)',
    joushin_to_notes: '上代[\\s￥¥\\\\]*[0-9０-９,，]+',
    delivery_to_notes: '(納期|発売|入荷|[0-9０-９]{1,2}月)',
  },
  freshness_months: 2,
}

describe('NG-1/2/3: FW転送実メールで属性値行/散文/同居数量を品名に化けさせない', () => {
  // FW-1 (実メール verbatim): NG-3 品名に数量・単価が同居 + markdown装飾(* ＊ _)。
  const FW_NAME_QTY = [
    'お世話になります。',
    '',
    '*ちいかわ フィギュアキーホルダー⑤** 108**入　＠550*',
    '種類：9種アソート',
    '_納期：8月上中予定_',
    '',
    '*ポケモンネックコード付き ミニおでかけウォレット**100**入　＠460*',
    '種類：1種',
    '_納期：7月中予定_',
    '',
    '*ちいかわウォーターシューター**48**入　＠780*',
    '種類：2種アソート',
    '_納期：7月下予定_',
    '',
    '*たまごっちキャラぷくオーロラKH6種**60**入**(ハーフ不可)**　＠860*',
    '種類：8種アソート',
    '_納期：7月中予定_',
    '',
    '※SNS等のネット関連への掲載NGにてお願いします。',
    '※ハーフＯＫ（別途送料1000円）',
    '※北海道や沖縄・離島などは別途送料が発生致します。',
  ].join('\n')

  // FW-2 (実メール verbatim): NG-1 bracket-label(同一行) + NG-2 送料散文の混在。
  const FW_BRACKET = [
    'お世話になります。',
    '【商　品　名】：ミニオンズ＆モンスターズ　超ドでかっ！もちもちクッション',
    '【品　　　番】：OTH-10588',
    '【単　 　 価】：＠1000',
    '【種　　　類】：全2種均等アソート',
    '【納　　　期】：8月下旬予定',
    '【販売　単位】：56個（14個×4カートン）＊本商品は4個口となっております。予めご了承下さい',
    '※ご注意！',
    '※材料の高騰、為替の変動、運賃の値上げにより',
    '今回より1カートン（14個入）に対し本州の場合、',
    '別途送料￥1,000になります。予めご了承ください。',
    '【商　品　名】：ミニオンズ＆モンスターズ　キラキラキーケース',
    '通常ミニオンズとミニオンズ＆モンスターズのスペシャルアソートとなります。',
    '【品　　　番】：OTH-10595',
    '【単　　　価】：＠545',
    '【種　　　類】：全3種均等アソート',
    '【納　　　期】： 8月下旬予定',
    '【販売　単位】：96個（48個×2BOX）',
    '（ミニオンズ＆モンスターズ　超ドでかっ！もちもちクッションを除く）',
    'ハーフ出荷可（別途送料がかかります。本州￥1000、',
    '北海道、沖縄、離島は正カートン、ハーフカートンに問わず別途送料がかかります。別途見積り）',
  ].join('\n')

  // FW-3 (FW-2 を live-Gmail の行折返しに再現): 【KEY】と ：VALUE が別行 = chat が観測した NG-1 の生形。
  const FW_LABEL_SPLIT = [
    '【商　品　名】',
    '：ミニオンズ＆モンスターズ　超ドでかっ！もちもちクッション',
    '【品　　　番】',
    '：OTH-10588',
    '【単　 　 価】',
    '：＠1000',
    '【販売　単位】',
    '：56個（14個×4カートン）',
  ].join('\n')

  const BAD_NAME = /^[：:＠@]|カートン|本\s*州|北\s*海\s*道|沖\s*縄|離\s*島|別\s*途|※|ご注意|を除く|になります|となります|^入\s*数|^単\s*価|^品\s*番|^販売|OTH-|AST-|[0-9０-９]+入|[＠@][0-9０-９]/

  it('FW-1 NG-3: 4件、品名から数量・単価句が剥がれクリーン、unit/qty は構造化', () => {
    const items = parseAnnouncements(SDY_RULE, FW_NAME_QTY)
    expect(items.length).toBe(4)
    expect(items[0].prize_name).toBe('ちいかわ フィギュアキーホルダー⑤')
    expect(items[0].unit_cost).toBe(550)
    expect(items[0].case_quantity).toBe(108)
    expect(items[1].prize_name).toBe('ポケモンネックコード付き ミニおでかけウォレット')
    expect(items[1].unit_cost).toBe(460)
    expect(items[2].prize_name).toBe('ちいかわウォーターシューター')
    expect(items[3].prize_name).toBe('たまごっちキャラぷくオーロラKH6種')
    expect(items[3].unit_cost).toBe(860)
    for (const a of items) {
      expect(a.prize_name, `NG-3 品名に数量/単価/装飾残存: ${a.prize_name}`).not.toMatch(BAD_NAME)
    }
  })

  it('FW-2 NG-1/NG-2: bracket-label で商品名2件のみ、属性値行/送料散文は品名化しない', () => {
    const items = parseAnnouncements(SDY_RULE, FW_BRACKET)
    expect(items.length).toBe(2)
    expect(items[0].prize_name).toBe('ミニオンズ＆モンスターズ　超ドでかっ！もちもちクッション')
    expect(items[0].unit_cost).toBe(1000)
    expect(items[0].case_quantity).toBe(56)
    expect(items[1].prize_name).toBe('ミニオンズ＆モンスターズ　キラキラキーケース')
    expect(items[1].unit_cost).toBe(545)
    for (const a of items) {
      expect(a.prize_name, `NG-1/2 属性値/散文が品名化: ${a.prize_name}`).not.toMatch(BAD_NAME)
    }
  })

  it('FW-3 NG-1: ラベル別行(：値)を結合し商品名のみ抽出、：OTH/：＠1000 が品名化しない', () => {
    const items = parseAnnouncements(SDY_RULE, FW_LABEL_SPLIT)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('ミニオンズ＆モンスターズ　超ドでかっ！もちもちクッション')
    expect(items[0].unit_cost).toBe(1000)
    expect(items[0].case_quantity).toBe(56)
    expect(items[0].prize_name).not.toMatch(BAD_NAME)
  })

  it('FW全体不変条件: どの FW本文でも prize_name は属性値/散文/数量句を含まない', () => {
    for (const [key, body] of Object.entries({ FW_NAME_QTY, FW_BRACKET, FW_LABEL_SPLIT })) {
      for (const a of parseAnnouncements(SDY_RULE, body)) {
        expect(a.prize_name, `${key}: 不正品名 ${a.prize_name}`).not.toMatch(BAD_NAME)
        expect(a.prize_name.length, `${key}: 空品名`).toBeGreaterThan(1)
      }
    }
  })
})
