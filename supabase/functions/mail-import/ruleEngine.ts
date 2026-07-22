// SPEC-MAIL-IMPORT-ENGINE-01 (D-090): 汎用メール取込ルールエンジン (純関数・副作用なし)。
// Deno / network 非依存 → Edge Function (Deno) と vitest (Node) の双方から import 可能
// (前例: supabase/functions/inf-mail-import/parseInfinity.ts, verify-pin/throttle.ts)。
//
// マーカー列挙方式(D-086 ★依存)を廃し、テーブル駆動 (mail_import_rules) の H1-H8 を実装:
//   H3 品名ソースは本文のみ (件名は使わない)。
//   H4 単価(＠)/入数(入等)を連れた実体行を品名とする。行頭記号は剥がし supplier_marker として notes へ。
//   H6 署名区切りより下は全捨て。
//   H2 【】3分岐: B1 行頭【key】value=キー名(値を採用) / B2 品名内の【】=外して notes / B3 単独【】=販促文言→notes。
//   H1 上代/ハーフ/納期/種類 は品名から分離し notes へ。
//   H7 鮮度は index.ts 側 (Gmail newer_than) + 呼び出し側で担保。
//   H8 既読化は index.ts 側 (dryRun ガード)。
// dedup キーに本文行番号を加える (H2でキャラ名が落ち同名衝突しても件数が減らないように)。

export interface MailRule {
  supplier_id: string
  from_pattern?: string
  is_announcement_rule?: { require_image?: boolean; forbid_attachment_regex?: string }
  name_marker_regex?: string[]           // H4後は [] (未使用)
  marker_strip_regex?: string            // 行頭記号クラス (剥がして supplier_marker 保存)
  exclude_line_regex?: string[]          // 行スキップ + 署名区切り検出に使う
  signature_cut_regex?: string[]         // H6 署名区切り (任意。無ければ exclude から推定)
  field_regex?: Record<string, string>
  freshness_months?: number
}

export interface ParsedAnnouncement {
  prize_name: string
  unit_cost: number | null
  case_quantity: number | null
  case_cost: number | null
  notes: string
  supplier_marker: string | null
  line_number: number   // 本文中の品名行の1始まり行番号 (dedup用)
}

// 全角数字/カンマ → 半角、カンマ除去。
function toHalfNumber(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[，]/g, ',')
    .replace(/,/g, '')
}
function toInt(s: string | null | undefined): number | null {
  const n = parseInt(toHalfNumber(s), 10)
  return Number.isFinite(n) ? n : null
}
function toNum(s: string | null | undefined): number | null {
  const n = parseFloat(toHalfNumber(s))
  return Number.isFinite(n) ? n : null
}

function compile(src?: string): RegExp | null {
  if (!src) return null
  try { return new RegExp(src) } catch { return null }
}
function compileAll(arr?: string[]): RegExp[] {
  return (arr ?? []).map((s) => compile(s)).filter((r): r is RegExp => r !== null)
}

// 最初にマッチした非空キャプチャ or マッチ全体を返す。
function firstCapture(re: RegExp | null, s: string): string | null {
  if (!re) return null
  const m = s.match(re)
  if (!m) return null
  for (let i = 1; i < m.length; i++) if (m[i] != null && m[i] !== '') return m[i]
  return m[0]
}

const DEFAULT_MARKER = /^[★☆●○◎◆◇■□▲△▼▽・\-*＊]+\s*/
// NG-1: ラベル別行FW/同一行いずれも 【key】[：]value 形を許容 (値先頭の全角/半角コロンを取り込む)。
const BRACKET_KEY_VALUE = /^【[^】]*】[\s　]*[：:]?[\s　]*(.+)$/  // B1: 行頭【key】[：]value
const BRACKET_ONLY = /^【[^】]*】[\s　]*[：:]?[\s　]*$/            // B3: 単独【】(値なし。ラベル別行の見出し行含む)
const BRACKET_INLINE = /【[^】]*】/g              // B2: 品名内の【】

// H1 の意味を持つ属性行判定に使う既定パターン (field_regex に無い場合の保険)。
const JOUSHIN = /上代/
const HALF = /ハーフ/
const SHURUI = /種類[：:]/
const DELIVERY = /(再?入荷|発売|納期|[0-9０-９]{1,2}月[上中下末]|[0-9０-９]{1,2}[／/][0-9０-９]{1,2}\s*締|即納)/

// BUG-D090-JOUSHIN-NAMELINE (gate_3): 品名行が上代等の属性トークンを同居していても、それらを剥がした残余に
// 品名実体が残るなら品名行とみなす (H5: 単価/入数を連れた実体行を品名)。属性/価格/数量/ラベル/日付/記号だけで
// 構成される行のみ非品名。ラベル語・日付断片は「品名実体が残るか」判定用のヒューリスティック (H4のマーカー列挙とは別問題)。
const NAME_LABEL = /(商\s*品\s*名|販\s*売\s*単\s*位|出\s*荷\s*単\s*位|販売数量|入\s*数|単\s*価|上\s*代|品\s*番|品\s*名|納\s*期|内\s*訳|ケース|税抜き?|税込み?|物販ライセンス)[：:]?/g
const DATE_FRAG = /([0-9０-９]{1,2}\s*[／/]\s*[0-9０-９]{1,2}|[0-9０-９]{1,4}\s*[年月日]|[上中下末旬]|[～〜]|即納|発売|再?入荷|締)/g
const PUNCT_STRIP = /[\s　:：()（）「」『』〈〉[\]{}\-ー―、。,.＠@#*＊※\/／¥￥\\★☆●○◎◆◇■□▲△▼▽・0-9０-９]+/g

// RegExp を global 化 (source を使い回し。null は素通し)。
function globalize(re: RegExp | null): RegExp | null {
  if (!re) return null
  return re.flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g')
}

// REG-1 対策: 行の「主たる内容」が属性か実体かで判定する。行頭(マーカー除去後)が 属性ラベル / 価格 / 数量 / 日付
// で始まる行は属性行 = 品名行でない。type_B(上代同居)は上代が行末に付き行頭が実体で始まるため区別できる。
// これらは供給属性の語彙であって品名先頭には現れない (H4のマーカー列挙とは別問題=属性ラベルの識別)。
// BUG-D090-OKURIGANA-IRIKAZU: 送り仮名「入り数」を 入\s*り?\s*数 で拾う (入数/入　数 も従来通りマッチ)。
const ATTR_HEAD = /^(入\s*り?\s*数|価\s*格|単\s*価|特\s*価|定\s*価|卸\s*値|仕\s*切り?|出\s*荷\s*単\s*位|発\s*送\s*単\s*位|販\s*売\s*単\s*位|販売数量|商\s*品\s*名|品\s*番|品\s*名|納\s*期|種\s*類|内\s*訳|上\s*代|ハーフ|物販ライセンス|物販品|別?途?送\s*料|ケース)/
const PRICE_QTY_HEAD = /^(?:[＠@]\s*[0-9０-９]|[0-9０-９]+\s*(?:入り?|個単位|枚単位|個|足))/
// BUG-D090-OKURIGANA-IRIKAZU: 「すべて48入り…」等の数量前置修飾を剥がして属性判定に回す (数字が続く場合のみ)。
const QTY_QUANTIFIER = /^(?:すべて|全て|全部)(?=[\s　]*[0-9０-９])/
const DATE_HEAD = /^(?:[0-9０-９]{1,2}\s*[／/]\s*[0-9０-９]|[0-9０-９]{1,2}\s*月|即納|発売|再?入荷)/

// REG-3 対策: 上代を「金額込みで1トークン」として品名から除去する。rule.joushin_to_notes が欠落/破損して
// c.joushinRe が既定 /上代/ に落ちても、ここで金額(税抜き/OPEN含む)まで確実に剥がす (品名に ￥ を残さない)。
const JOUSHIN_STRIP = /上\s*代[\s　：:]*[￥¥\\]?\s*(?:[0-9０-９,，]+|OPEN|オープン)?[\s　]*(?:税抜き?|税込み?)?/g

// NG-1 (FW転送): 行頭【KEY】の KEY が「商品名/品名」のときだけ値が品名。他KEY(単価/品番/種類/納期/販売単位/内訳等)は属性。
// 品番の英数値(AST-10266)が nameResidual を素通りして品名化する事故を構造的に排除する。
const NAME_KEY = /^(商品名|品名)$/
// NG-2 (FW転送): 送料・配送・注意書きの散文。品名には現れない語彙に限定して非品名判定に使う (実データで品名と非衝突を確認)。
const NOTICE = /(別\s*途\s*(送料|運賃|見積|お?見積り?)|本\s*州|北\s*海\s*道|沖\s*縄|離\s*島|個口|予めご了承|ご了承(下さい|ください)|になります|材料の高騰|為替|運\s*賃|値上げ|カートン|を除く|となります|掲\s*載|ご遠慮|出荷不可|問わず|ご注意|締\s*切|発生致します)/
// NG-3 (FW転送): 品名末尾に同居する 数量(N入/個/足) / 単価(＠N[円-]) の句を末尾から剥がす (REG-2教訓=末尾句限定、行途中は削らない)。
//   実データの markdown 装飾(* ＊ _)・全角空白・(ハーフ不可) 等の挿入に耐えるよう区切りを許容。
const NAME_TAIL_TOKEN = '(?:[0-9０-９,，]+[\\s　*＊_]*(?:入り?|個|足)(?:単位)?|[＠@][\\s　*＊_]*[0-9０-９,，]+[\\s　*＊_]*円?[ー\\-－]*)'
const NAME_TAIL_STRIP = new RegExp(`[\\s　*＊_]*(?:${NAME_TAIL_TOKEN}[\\s　*＊_]*(?:[（(][^）)]*[）)])?[\\s　*＊_]*)+$`)

interface RuleCompiled {
  unitRe: RegExp | null
  qtyRe: RegExp | null
  joushinRe: RegExp
  halfRe: RegExp
  deliveryRe: RegExp
  excludeRes: RegExp[]
  signatureRes: RegExp[]
  markerRe: RegExp
}

function compileRule(rule: MailRule): RuleCompiled {
  const fr = rule.field_regex ?? {}
  const excludeRes = compileAll(rule.exclude_line_regex)
  // H6: 明示 signature_cut_regex があれば使う。無ければ exclude のうち署名らしいものを流用。
  const signatureSrc = rule.signature_cut_regex
    ?? (rule.exclude_line_regex ?? []).filter((s) => /株式会社|INFINITY|◇◆|\^--|TEL|FAX|〒/.test(s))
  return {
    unitRe: compile(fr.unit_cost),
    qtyRe: compile(fr.case_quantity),
    joushinRe: compile(fr.joushin_to_notes) ?? JOUSHIN,
    halfRe: compile(fr.half_to_notes) ?? HALF,
    deliveryRe: compile(fr.delivery_to_notes ?? fr.release_date_to_notes) ?? DELIVERY,
    excludeRes,
    signatureRes: compileAll(signatureSrc),
    markerRe: compile(rule.marker_strip_regex) ?? DEFAULT_MARKER,
  }
}

// 案内メール判定 (H8 の入口)。require_image=true かつ 受書xlsx等の禁止添付なし → 案内。
export function isAnnouncement(
  rule: MailRule,
  mail: { attachmentNames?: string[]; hasImage?: boolean },
): boolean {
  const r = rule.is_announcement_rule ?? {}
  if (r.require_image && !mail.hasImage) return false
  if (r.forbid_attachment_regex) {
    const re = compile(r.forbid_attachment_regex)
    if (re && (mail.attachmentNames ?? []).some((n) => re.test(n))) return false
  }
  return true
}

interface Line { n: number; s: string }

// 属性行 (H1: 上代/ハーフ/納期/種類 / B3単独【】) = 品名にならず notes 行。
function isAttrLine(c: RuleCompiled, s: string): boolean {
  return (
    c.joushinRe.test(s) ||
    c.halfRe.test(s) ||
    SHURUI.test(s) ||
    BRACKET_ONLY.test(s) ||
    c.deliveryRe.test(s)
  )
}
function isPriceOrQty(c: RuleCompiled, s: string): boolean {
  return (!!c.unitRe && c.unitRe.test(s)) || (!!c.qtyRe && c.qtyRe.test(s))
}

// 行から マーカー/【】/属性(上代ハーフ種類納期)/価格/数量/ラベル語/日付/記号 を剥がした残余 = 品名実体。
function nameResidual(c: RuleCompiled, s: string): string {
  let r = s
  const mk = r.match(c.markerRe); if (mk) r = r.slice(mk[0].length)
  r = r.replace(BRACKET_KEY_VALUE, '$1') // B1: value を実体として残す
  r = r.replace(BRACKET_INLINE, '')
  for (const re of [globalize(c.joushinRe), globalize(c.halfRe), globalize(SHURUI), globalize(c.deliveryRe), globalize(c.unitRe), globalize(c.qtyRe)]) {
    if (re) r = r.replace(re, '')
  }
  return r.replace(NAME_LABEL, '').replace(DATE_FRAG, '').replace(PUNCT_STRIP, '')
}

// 品名候補行 = 行頭(マーカー除去後)が 属性ラベル/価格/数量/日付 で始まらず、実体が2文字以上ある行。
// REG-1: 行頭が属性(入数/価格/出荷単位/上代/ハーフ/納期 等)や ＠/N入/N月 で始まる行は属性行 → 品名にしない。
// type_B(上代同居)は行頭が実体で始まるので拾える。BUG-D090: 旧実装は上代の部分マッチで品名行を落としていた。
function isNameLine(c: RuleCompiled, s: string): boolean {
  // NG-2: 行頭※の注意書き / 送料・配送の散文は品名でない (markerで消える前に原文で判定)。
  if (/^[\s　_*＊]*※/.test(s)) return false
  if (NOTICE.test(s)) return false
  // BUG-D090-OKURIGANA-IRIKAZU 対策の副次: 句点で終わる説明文(…高いです。/…参照ください。)は品名でない。
  //   「入り数」を属性化した結果あらわになる散文が数量を吸って品名化するのを防ぐ (品名は句点で終わらない)。
  if (/。[\s　]*$/.test(s)) return false
  let head = s
  const mk = head.match(c.markerRe); if (mk) head = head.slice(mk[0].length)
  head = head.replace(/^[\s　_*＊]+/, '') // markdown装飾/空白の先頭剥がし
  head = head.replace(QTY_QUANTIFIER, '') // 数量前置修飾(すべて/全て)を剥がして属性判定へ
  if (!head) return false
  // NG-1: ラベル別行FWで値だけが独立した ：VALUE 行 = 属性値 (【商品名】の値は merge 済で head が【始まり)。
  if (/^[：:]/.test(head)) return false
  // NG-1/H2: 行頭【KEY】value は KEY で判定。商品名/品名=値が品名、他KEY(単価/品番/種類/納期/販売単位/内訳等)=属性。
  const bk = head.match(/^【([^】]*)】/)
  if (bk) {
    const key = bk[1].replace(/[\s　]/g, '')
    if (NAME_KEY.test(key)) return nameResidual(c, s).length >= 2
    return false
  }
  if (ATTR_HEAD.test(head) || PRICE_QTY_HEAD.test(head) || DATE_HEAD.test(head)) return false
  return nameResidual(c, s).length >= 2
}

// 品名正規化: 行頭マーカー剥がし(H4) + 品名内【】外し(B2) + B1のkey剥がし。
function normalizeName(c: RuleCompiled, raw: string): { name: string; marker: string | null; bracketNotes: string[] } {
  let s = raw
  const bracketNotes: string[] = []
  // B1: 行頭【key】value → value 採用
  const b1 = s.match(BRACKET_KEY_VALUE)
  if (b1) s = b1[1]
  // 行頭マーカー剥がし → supplier_marker
  let marker: string | null = null
  const mk = s.match(c.markerRe)
  if (mk) { marker = mk[0].trim() || null; s = s.slice(mk[0].length) }
  // B2: 品名内の【…】は外して notes へ
  s = s.replace(BRACKET_INLINE, (m) => { bracketNotes.push(m); return '' })
  // BUG-D090-JOUSHIN-NAMELINE / REG-3: 品名行末尾に同居する 上代(金額込み) を notes へ移し品名から除去 (AC4)。
  //   REG-2 教訓: ハーフ/納期の語単位除去は品名破損を招くため normalizeName では行わない
  //   (それらは属性行にあり isNameLine で除外済。品名行に同居するのは実データ上ほぼ 上代 のみ)。
  //   種類(N種)は品名の一部として残す (fixture の "6種"/"2種" 温存)。
  s = s.replace(JOUSHIN_STRIP, (m) => { const t = m.trim(); if (t && t !== '上代') bracketNotes.push(t); return '' })
  // NG-3: 品名末尾に同居する 数量(N入/個/足)・単価(＠N) の句を末尾から剥がし notes へ (REG-2教訓=末尾句限定)。
  s = s.replace(NAME_TAIL_STRIP, (m) => { const t = m.replace(/[\s　*＊_]/g, '').trim(); if (t) bracketNotes.push(t); return '' })
  // AC4 最終保証: 品名に 上代/【】/￥¥ が残っていたら除去。先頭/末尾の markdown 装飾(* ＊ _)・空白も除去。
  const name = s
    .replace(/上\s*代/g, '').replace(/[【】￥¥]/g, '')
    .replace(/^[\s　*＊_]+/, '').replace(/[\s　*＊_]+$/, '')
    .trim()
  return { name, marker, bracketNotes }
}

// 本文をパースして案内配列を返す (品名行番号付き)。
export function parseAnnouncements(rule: MailRule, body: string): ParsedAnnouncement[] {
  const c = compileRule(rule)
  // 1) 行分解 (1始まり行番号を保持、空行除去)
  const raw: Line[] = []
  String(body ?? '').split(/\r?\n/).forEach((t, i) => {
    const s = t.trim()
    if (s) raw.push({ n: i + 1, s })
  })
  // 1.5) NG-1 (FW転送): 見出し行【KEY】が改行され値が次行 ：VALUE に落ちる形を結合 (【KEY】VALUE 化)。
  //   ラベルと値が別行になり、値行の行頭が ： になって品名判定を素通りする事故を構造的に潰す。
  //   品名行番号(dedup用)は見出し行の n を採用し安定させる。
  const all: Line[] = []
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k]
    const next = raw[k + 1]
    if (next && /】[\s　]*$/.test(cur.s) && /^[\s　]*[：:]/.test(next.s)) {
      all.push({ n: cur.n, s: cur.s.replace(/[\s　]*$/, '') + next.s.replace(/^[\s　]*[：:][\s　]*/, '') })
      k++ // 値行を消費
    } else {
      all.push(cur)
    }
  }
  // 2) H6 署名区切り: 最初にマッチした行以降を全捨て
  const cutIdx = all.findIndex((l) => c.signatureRes.some((re) => re.test(l.s)))
  const kept0 = cutIdx >= 0 ? all.slice(0, cutIdx) : all
  // 3) 行スキップ (exclude_line_regex)
  const kept = kept0.filter((l) => !c.excludeRes.some((re) => re.test(l.s)))

  // 4) メール先頭の共通ヘッダ (最初の品名行より前の属性行 = 納期等) → 全案内 notes に付す
  const firstNameIdx = kept.findIndex((l) => isNameLine(c, l.s) && !BRACKET_ONLY.test(l.s))
  const headerNotes: string[] = []
  if (firstNameIdx > 0) {
    for (const l of kept.slice(0, firstNameIdx)) {
      if (isAttrLine(c, l.s)) headerNotes.push(l.s)
    }
  }

  // 5) H4 ブロック化: 品名行から次の品名行の手前までを1ブロック。価格/数量を含むブロックのみ採用。
  const items: ParsedAnnouncement[] = []
  let i = 0
  while (i < kept.length) {
    const line = kept[i]
    if (isNameLine(c, line.s) && !BRACKET_ONLY.test(line.s)) {
      let j = i + 1
      while (j < kept.length && !(isNameLine(c, kept[j].s) && !BRACKET_ONLY.test(kept[j].s))) j++
      const block = kept.slice(i, j)
      if (block.some((b) => isPriceOrQty(c, b.s))) {
        items.push(buildItem(c, line, block, headerNotes))
      }
      i = j
    } else {
      i++
    }
  }
  return items
}

function buildItem(c: RuleCompiled, nameLine: Line, block: Line[], headerNotes: string[]): ParsedAnnouncement {
  const { name, marker, bracketNotes } = normalizeName(c, nameLine.s)

  let unit_cost: number | null = null
  let case_quantity: number | null = null
  const notesParts: string[] = []

  for (const b of block) {
    // NG-3: markdown装飾(* ＊ _)が数字と単位の間に挟まる実データ("108**入")でも単価/入数を取りこぼさない。
    const t = b.s.replace(/[*＊_]/g, '')
    if (unit_cost == null && c.unitRe && c.unitRe.test(t)) unit_cost = toNum(firstCapture(c.unitRe, t))
    if (case_quantity == null && c.qtyRe && c.qtyRe.test(t)) case_quantity = toInt(firstCapture(c.qtyRe, t))
    // 属性行 (品名行自身は除く) を notes へ
    if (b.n !== nameLine.n && isAttrLine(c, b.s)) notesParts.push(b.s)
  }
  // B2 で品名から外した【】、行頭マーカー、メール共通ヘッダ
  for (const bn of bracketNotes) notesParts.push(bn)
  for (const h of headerNotes) notesParts.push(h)
  if (marker) notesParts.push(`[marker:${marker}]`)

  const case_cost = unit_cost != null && case_quantity != null ? unit_cost * case_quantity : null

  return {
    prize_name: name,
    unit_cost,
    case_quantity,
    case_cost,
    notes: [...new Set(notesParts)].join(' / '),
    supplier_marker: marker,
    line_number: nameLine.n,
  }
}

// dedup キー: source_ref + prize_name + 行番号 (同名衝突で件数が減らないように行番号を含める)。
export function dedupKey(sourceRef: string, prizeName: string, lineNumber: number | null): string {
  return `${sourceRef}${prizeName}${lineNumber ?? ''}`
}

// 既存キーに無い案内だけ残す。既存キーは index.ts が source_ref+prize_name+source_line から構築する。
export function filterNewAnnouncements(
  items: ParsedAnnouncement[],
  sourceRef: string,
  existingKeys: string[],
): ParsedAnnouncement[] {
  const seen = new Set(existingKeys)
  const out: ParsedAnnouncement[] = []
  for (const it of items) {
    const k = dedupKey(sourceRef, it.prize_name, it.line_number)
    if (seen.has(k)) continue
    seen.add(k) // 同一 run 内の重複も防ぐ
    out.push(it)
  }
  return out
}
