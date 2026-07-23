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

// BUG-D090-OKURIGANA-IRIKAZU (本実行後の全件SQL検査で検出、208件中3件): 「入り数」「入り」(送り仮名) の属性行が品名化。
//   id=10818 すべて48入り　＠590　ハーフ1200円 / id=10911 入り数：１２０個（６入り×２０ＢＯＸ） / id=10952 入り数８０入り　（８×１０）。
//   真因: ATTR_HEAD の 入\s*数 が 入り数(送り仮名) を拾わず属性行が品名判定を通過。すべて48入り は数量前置修飾で行頭判定を抜けていた。
//   mail_sampling_raw の実メール本文をそのまま流し、属性行が品名化せず本来の品名が正しく採れることを検証。
describe('BUG-D090-OKURIGANA-IRIKAZU: 「入り数」「入り」属性行を品名化させない (実データ)', () => {
  // 送り仮名対応の INF系ルール (case_quantity は 入 で 入り の数字を既に拾える)。
  const IRI_RULE = {
    supplier_id: 'INF',
    is_announcement_rule: { require_image: true, forbid_attachment_regex: '請書.*\\.xlsx?$' },
    name_marker_regex: [],
    marker_strip_regex: '^[★☆●○◎◆◇■□▲△▼▽・\\-*＊]+\\s*',
    exclude_line_regex: ['^\\s*$', 'INFINITY', '株式会社', '◇◆'],
    signature_cut_regex: ['^--\\s*$', '◇◆◇'],
    field_regex: {
      unit_cost: '[＠@]\\s*([0-9０-９][0-9０-９,，]{1,})',
      case_quantity: '([0-9０-９]+)\\s*(?:入り?|個単位|枚単位|個|足)',
      half_to_notes: 'ハーフ[\\s]*(不可|可|[0-9０-９]+円|送料[0-9０-９]+)',
      joushin_to_notes: '上代[\\s￥¥\\\\]*[0-9０-９,，]+',
      delivery_to_notes: '(納期|発売|入荷|予定|[0-9０-９]{1,2}月|中[0-9０-９]+日)',
    },
    freshness_months: 2,
  }

  // id=10818 立体キャラクターマシュコット (品名の次行が「すべて48入り ＠590 ハーフ1200円」)
  const IRI_A = [
    '立体キャラクターマシュコット',
    '物販ライセンスのため予告なしに入荷しなくなる場合もありますのでご了承ください',
    'すべて48入り　＠590　ハーフ1200円',
    '8/下～予定',
    '納入日より６ヶ月以内の商品瑕疵による返品は受付いたします。',
    '※北海道や沖縄・離島などは別途送料が発生致します。',
  ].join('\n')

  // id=10911 サンリオ アンブレラチャーム (「入り数：１２０個…」+ 説明散文が同居)
  const IRI_B = [
    'サンリオキャラクターズ アンブレラチャーム（６種）',
    '上代￥６９０（単品）',
    '１個単価：＠３７５　',
    '＊ＢＯＸ入りのため、他のアンブレラチャームより値段少しだけ高いです。',
    '入り数：１２０個（６入り×２０ＢＯＸ）　＊６種均等',
    '内容は、資料ご参照ください。',
    '納期：中３～４日',
  ].join('\n')

  // id=10952 たまごっち缶バッチ (「入り数８０入り」) + 2品目に「入り数60入」(入り数ラベル+通常入)
  const IRI_C = [
    '●たまごっち缶バッチ＆ホルダーセット',
    '入り数８０入り　（８×１０）　＠740',
    '＜アソート内容＞',
    'RM-8216',
    '缶バッジ&ホルダーセット',
    '＼1,200',
    '８月下旬　　',
    '●たまごっちミニチュアポシェット　４種～６種おまかせアソート',
    '上代：￥1,200-　ご発注ロット：3　',
    '入り数60入　（3×２０）＠750',
  ].join('\n')

  const IRIKAZU_BAD = /^入\s*り?\s*数|^すべて[0-9０-９]|^１?個?単価|^上\s*代|^納\s*期|^物販|。[\s　]*$|入荷しなくなる/

  it('IRI-A: 品名=立体キャラクターマシュコット、すべて48入り行は品名化しない (単価590/入数48)', () => {
    const items = parseAnnouncements(IRI_RULE, IRI_A)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('立体キャラクターマシュコット')
    expect(items[0].unit_cost).toBe(590)
    expect(items[0].case_quantity).toBe(48) // 「すべて48入り」の入り数48を抽出
  })

  it('IRI-B: 品名=サンリオ アンブレラチャーム、入り数行/説明散文は品名化しない (単価375)', () => {
    const items = parseAnnouncements(IRI_RULE, IRI_B)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('サンリオキャラクターズ アンブレラチャーム（６種）')
    expect(items[0].unit_cost).toBe(375)
    expect(items.some((a) => /^入り数|ＢＯＸ入りのため/.test(a.prize_name))).toBe(false)
  })

  it('IRI-C: 缶バッチ/ポシェット2品、入り数８０入り・入り数60入は品名化しない (740/80, 750/60)', () => {
    const items = parseAnnouncements(IRI_RULE, IRI_C)
    const kanbatch = items.find((a) => /缶バッチ/.test(a.prize_name))
    const poche = items.find((a) => /ポシェット/.test(a.prize_name))
    expect(kanbatch).toBeTruthy()
    expect(kanbatch.prize_name).toBe('たまごっち缶バッチ＆ホルダーセット')
    expect(kanbatch.unit_cost).toBe(740)
    expect(kanbatch.case_quantity).toBe(80) // 入り数８０入り
    expect(poche).toBeTruthy()
    expect(poche.unit_cost).toBe(750)
    expect(poche.case_quantity).toBe(60) // 入り数60入 (通常入)
    expect(items.some((a) => /^入り数/.test(a.prize_name))).toBe(false)
  })

  it('全3通不変条件: どの prize_name も入り数/入り属性行・説明散文由来でない', () => {
    for (const [key, body] of Object.entries({ IRI_A, IRI_B, IRI_C })) {
      for (const a of parseAnnouncements(IRI_RULE, body)) {
        expect(a.prize_name, `${key}: 不正品名 ${a.prize_name}`).not.toMatch(IRIKAZU_BAD)
        expect(a.prize_name.length, `${key}: 空品名`).toBeGreaterThan(1)
      }
    }
  })

  // 回帰確認 (ディスパッチ要件): 送り仮名なしの 入/N入 が従来通り壊れていないこと。
  it('回帰: 送り仮名なし 入/N入 の既存動作が不変 (入数ラベル非品名・N入で入数抽出)', () => {
    // 「入数：」ラベル (送り仮名なし)
    const plain1 = ['●こびとづかんアソート', '入数：９６個　ハーフ送料１０００円', '単価：＠565'].join('\n')
    const i1 = parseAnnouncements(IRI_RULE, plain1)
    expect(i1.length).toBe(1)
    expect(i1[0].prize_name).toBe('こびとづかんアソート')
    expect(i1[0].case_quantity).toBe(96)
    expect(i1.some((a) => /入数/.test(a.prize_name))).toBe(false)
    // 「60入」(送り仮名なしN入)
    const plain2 = ['■サラブレッド ぬいぐるみBC　6種', '60入　＠1000-'].join('\n')
    const i2 = parseAnnouncements(IRI_RULE, plain2)
    expect(i2.length).toBe(1)
    expect(i2[0].prize_name).toBe('サラブレッド ぬいぐるみBC　6種')
    expect(i2[0].case_quantity).toBe(60)
    expect(i2[0].unit_cost).toBe(1000)
  })
})

// BUG-D090-TANNI-SHIPPING (D-090 6周目, ひろGO=恒久対応): 「単位N個　ハーフ可別途＠1000 / 仕切り＠XXX」型で
//   R1 行頭「単位N」が品名化し本来の品名が落ちる + R2 送料の＠1000が単価に採られ本来の仕切り単価が無視される。
//   実データ本文(mail_parse_samples.body_head verbatim)で R1/R2/R3 を検証。
describe('BUG-D090-TANNI-SHIPPING: 単位行を品名化させず送料＠を単価にしない (実データ)', () => {
  const TANNI_RULE = {
    supplier_id: 'INF',
    is_announcement_rule: { require_image: true, forbid_attachment_regex: '請書.*\\.xlsx?$' },
    name_marker_regex: [],
    marker_strip_regex: '^[★☆●○◎◆◇■□▲△▼▽・\\-*＊]+\\s*',
    exclude_line_regex: ['^\\s*$', 'INFINITY', '株式会社', '◇◆'],
    signature_cut_regex: ['^--\\s*$', '◇◆◇', 'INFINITY', '株式会社インフィニティ'],
    field_regex: {
      unit_cost: '[＠@]\\s*([0-9０-９][0-9０-９,，]{1,})',
      case_quantity: '([0-9０-９]+)\\s*(?:入り?|個単位|枚単位|個|足)',
      half_to_notes: 'ハーフ[\\s]*(不可|可|[0-9０-９]+円|送料[0-9０-９]+)',
      joushin_to_notes: '上代[\\s￥¥\\\\]*[0-9０-９,，]+',
      delivery_to_notes: '(納期|発売|入荷|予定|即納|[0-9０-９]{1,2}月)',
    },
    freshness_months: 2,
  }

  // 19f5a2a835a09645 (verbatim body_head): ディズニーサンゴマイヤーハーフケット A/B セット
  const TANNI_AB = [
    'お世話になります。',
    '５６８',
    'ディズニーサンゴマイヤーハーフケット(絵羽柄)Aセット',
    '単位７２個　　　ハーフ可別途＠１０００',
    '仕切り＠９００',
    '納期　　１０月中～下予定',
    '５７５',
    'ディズニーサンゴマイヤーハーフケット(絵羽柄)Bセット',
    '単位７２個　　　ハーフ可別途＠１０００',
    '仕切り＠９００',
    '納期　　１０月中～下予定',
    '※ご発注の際は必ず品番を記載して頂きますようお願いします。',
    '※ネットでの販売はご遠慮下さい。ネットキャッチャーＯＫです。',
  ].join('\n')

  // 19f68d175fa7609a (verbatim): ディズニーもちもちダイカットフェイスクッション (単品)
  const TANNI_1 = [
    'お世話になります。',
    '５８２',
    'ディズニーもちもちダイカットフェイスクッション',
    '単位４０個　　　ハーフ可別途＠１０００',
    '仕切り＠９８０',
    '納期　　９月下～１０月上予定',
    '※現在、監修中です。',
  ].join('\n')

  // 19ef207d9e2e5a73 (verbatim): ベビージョージ他4商品 (INFINITY署名でH6カット)
  const TANNI_4 = [
    'お世話になります。',
    'ベビージョージチャーム付きふわふわマスコットBC',
    '単位１２０個　　　　ハーフ可別途＠１０００',
    '仕切り＠４７５',
    'ベビージョージパジャママスコットBC',
    '単位１２０個　　　　ハーフ可別途＠１０００',
    '仕切り＠４９５',
    'トム＆ジェリーマリンルックマスコットBC',
    '単位１２０個　　　　ハーフ可別途＠１０００',
    '仕切り＠５１５',
    'スヌーピーパールボアマスコットBC',
    '単位１６０個　　　　ハーフ可別途＠１０００',
    '仕切り＠４７５',
    '納期　　ただいま即納',
    '∞INFINITY∞INFINITY∞INFINITY∞',
    '株式会社インフィニティ',
  ].join('\n')

  it('R1/R2/R3 対象1 (A/B 2件): 品名=ハーフケットA/Bセット、単価900(仕切り,送料1000でない)、入数72', () => {
    const items = parseAnnouncements(TANNI_RULE, TANNI_AB)
    expect(items.length).toBe(2)
    expect(items[0].prize_name).toBe('ディズニーサンゴマイヤーハーフケット(絵羽柄)Aセット')
    expect(items[1].prize_name).toBe('ディズニーサンゴマイヤーハーフケット(絵羽柄)Bセット')
    for (const a of items) {
      expect(a.unit_cost, 'R2: 仕切り900を採る (送料1000でない)').toBe(900)
      expect(a.case_quantity, 'R3: 入数72維持').toBe(72)
      expect(a.prize_name).not.toMatch(/^単位|ハーフ可別途/)
    }
  })

  it('R1/R2/R3 対象2 (単品): 品名=ダイカットフェイスクッション、単価980、入数40', () => {
    const items = parseAnnouncements(TANNI_RULE, TANNI_1)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('ディズニーもちもちダイカットフェイスクッション')
    expect(items[0].unit_cost).toBe(980)
    expect(items[0].case_quantity).toBe(40)
  })

  it('R1/R2/R3 対象3 (4商品): 各 本来の品名 + 仕切り単価 (475/495/515/475)、入数120/160', () => {
    const items = parseAnnouncements(TANNI_RULE, TANNI_4)
    expect(items.length).toBe(4)
    expect(items[0].prize_name).toBe('ベビージョージチャーム付きふわふわマスコットBC')
    expect(items[0].unit_cost).toBe(475)
    expect(items[0].case_quantity).toBe(120)
    expect(items[1].prize_name).toBe('ベビージョージパジャママスコットBC')
    expect(items[1].unit_cost).toBe(495)
    expect(items[2].prize_name).toBe('トム＆ジェリーマリンルックマスコットBC')
    expect(items[2].unit_cost).toBe(515)
    expect(items[3].prize_name).toBe('スヌーピーパールボアマスコットBC')
    expect(items[3].unit_cost).toBe(475)
    expect(items[3].case_quantity).toBe(160)
    for (const a of items) expect(a.prize_name).not.toMatch(/^単位|ハーフ可別途/)
  })

  // 回帰 (spec指定、実データ): 出荷単位ラベル型 / FW販売単位型 / 単位+非数字(誤剥がし無し)。
  it('回帰1: 出荷単位ラベル型「出荷単位：７２個」は不変 (サンリオ ボアルームスリッパ, 単価880/入数72)', () => {
    // 19?? (verbatim): 単価は「単価：＠880」、送料は「＊ハーフ：別途１０００円」(円=＠でない)
    const body = [
      'サンリオ　ボアルームスリッパ６種　',
      '上代￥１，６８０（表記なし）',
      '単価：＠880',
      '出荷単位：７２個（６種各１２個）',
      'サイズ：大人用（２３～２５ｃｍ）　',
      '＊納期：１０月',
      '＊ハーフ：別途１０００円',
      '＊北海道、沖縄・その他離島の場合、別途送料かかります。',
    ].join('\n')
    const items = parseAnnouncements(TANNI_RULE, body)
    const real = items.filter((a) => /ボアルームスリッパ/.test(a.prize_name))
    expect(real.length).toBe(1)
    expect(real[0].unit_cost).toBe(880) // 単価880 (別途1000円の送料に引きずられない)
    expect(real[0].case_quantity).toBe(72)
  })

  it('回帰2: FW販売単位型「【販売　単位】：４８個」は不変 (日焼けキティ ブランケット, 単価1000/入数48)', () => {
    const body = [
      '【商　品　名】：サンリオ 日焼けキティ　フランネルボアブランケットVer.2',
      '【品　　　番】：AST-10281',
      '【単　　　価】：＠1000',
      '【種　　　類】：全2種均等アソート',
      '【納　　　期】： 10月上～中旬予定',
      '【販売　単位】：48個（24個×2カートン）※本商品は2個口となっております。予めご了承ください。',
    ].join('\n')
    const items = parseAnnouncements(TANNI_RULE, body)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('サンリオ 日焼けキティ　フランネルボアブランケットVer.2')
    expect(items[0].unit_cost).toBe(1000) // 【単価】の＠1000は送料でないので採る
    expect(items[0].case_quantity).toBe(48)
  })

  it('回帰3: 単位+非数字は誤剥がししない「単位展開マスコット５種」(品名維持, 単価800/入数72)', () => {
    const body = ['単位展開マスコット５種', '出荷単位：７２個', '単価：＠800'].join('\n')
    const items = parseAnnouncements(TANNI_RULE, body)
    expect(items.length).toBe(1)
    expect(items[0].prize_name).toBe('単位展開マスコット５種')
    expect(items[0].unit_cost).toBe(800)
    expect(items[0].case_quantity).toBe(72)
  })
})
