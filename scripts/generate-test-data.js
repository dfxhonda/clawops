/**
 * ClawOps テストデータ生成スクリプト
 * バイト3名 × 4店舗 × 3ヶ月分のリアルな巡回入力データを生成
 *
 * 出力: CSV + Sheets API用JSON
 * 用途: meter_readingsシートに一括投入
 *
 * シート列: reading_id, booth_id, full_booth_code, read_time,
 *          in_meter, out_meter, prize_restock_count, prize_stock_count,
 *          prize_name, input_method, qr_code, scan_image, note, created_at,
 *          set_a, set_c, set_l, set_r, set_o
 */

const { writeFileSync } = require('fs')

// ========================================
// マスタ定義（実際のClawOps店舗構成に合わせる）
// ========================================
const STORES = [
  {
    store_code: 'KIK01', store_name: '菊陽',
    machines: [
      { code: 'M01', name: 'セサミW1', type: 'SESAME_W', price: 100, booths: ['B01','B02','B03','B04'] },
      { code: 'M02', name: 'セサミW2', type: 'SESAME_W', price: 100, booths: ['B01','B02','B03','B04'] },
      { code: 'M03', name: 'Buzz9L', type: 'BUZZ', price: 200, booths: ['B01','B02','B03','B04'] },
      { code: 'M04', name: '500ガチャ', type: 'HIGH_GACHA', price: 500, booths: ['B01','B02','B03'] },
    ]
  },
  {
    store_code: 'KOS01', store_name: '合志',
    machines: [
      { code: 'M01', name: 'セサミW1', type: 'SESAME_W', price: 100, booths: ['B01','B02','B03','B04'] },
      { code: 'M02', name: 'セサミW2', type: 'SESAME_W', price: 100, booths: ['B01','B02','B03','B04'] },
      { code: 'M03', name: 'Buzz2L', type: 'BUZZ', price: 200, booths: ['B01','B02','B03','B04'] },
      { code: 'M04', name: 'Buzz2Lミコ', type: 'BUZZ', price: 200, booths: ['B01','B02','B03','B04'] },
      { code: 'M05', name: '27円ガチャ', type: 'HIGH_GACHA', price: 100, booths: ['B01','B02','B03'] },
    ]
  },
  {
    store_code: 'SIM01', store_name: '下通',
    machines: [
      { code: 'M01', name: 'セサミW3', type: 'SESAME_W', price: 100, booths: ['B01','B02','B03','B04'] },
      { code: 'M02', name: 'Buzz9L', type: 'BUZZ', price: 200, booths: ['B01','B02','B03','B04'] },
      { code: 'M03', name: '27円ガチャ', type: 'HIGH_GACHA', price: 100, booths: ['B01','B02'] },
    ]
  },
  {
    store_code: 'MNK01', store_name: '南熊本',
    machines: [
      { code: 'M01', name: 'セサミW1', type: 'SESAME_W', price: 100, booths: ['B01','B02','B03','B04'] },
      { code: 'M02', name: 'R2014 Buzz9L', type: 'BUZZ', price: 200, booths: ['B01','B02','B03','B04'] },
      { code: 'M03', name: '500ガチャ', type: 'HIGH_GACHA', price: 500, booths: ['B01','B02','B03'] },
    ]
  },
]

// スタッフ（個性あり）
const STAFF = [
  {
    name: '山田', role: 'リーダー',
    reliability: 0.98,  // 入力忘れ率2%
    speed: 1.0,
    errorRate: 0.01,    // 入力ミス率1%
    stores: ['KIK01','KOS01','SIM01','MNK01'],  // 全店舗担当
    daysPerWeek: [1,3,5],  // 月水金
  },
  {
    name: '田中', role: '新人バイト',
    reliability: 0.90,  // 入力忘れ率10%
    speed: 0.7,
    errorRate: 0.05,    // 入力ミス率5%（新人なので高い）
    stores: ['KIK01','KOS01'],  // 2店舗担当
    daysPerWeek: [2,4,6],  // 火木土
  },
  {
    name: '佐藤', role: '新人バイト',
    reliability: 0.92,
    speed: 0.8,
    errorRate: 0.03,
    stores: ['SIM01','MNK01'],  // 2店舗担当
    daysPerWeek: [2,4,6],
  },
]

// 景品名プール
const PRIZE_NAMES = [
  'ちいかわ ぬいぐるみ BIG', 'SPY×FAMILY アーニャ フィギュア', 'ワンピース ルフィ DXF',
  '呪術廻戦 五条悟 フィギュア', 'ドラゴンボール 悟空 BWFC', 'ポケモン ピカチュウ ぬいぐるみ',
  '鬼滅の刃 禰豆子 フィギュア', 'ブルーロック 潔 フィギュア', '推しの子 アイ フィギュア',
  'すみっコぐらし BIG ぬいぐるみ', 'サンリオ クロミ マスコット', 'ディズニー ミッキー ぬいぐるみ',
  'モルカー ポテト ぬいぐるみ', 'ちいかわ ハチワレ BIG', 'SPY×FAMILY ボンド ぬいぐるみ',
  'マリオ スーパースター フィギュア', 'ポケモン イーブイ ぬいぐるみ', '星のカービィ BIG',
  'ぼっち・ざ・ろっく！ ぬいぐるみ', 'チェンソーマン ポチタ マスコット',
]

// ========================================
// ユーティリティ
// ========================================
let readingCounter = 0

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min, max) { return Math.random() * (max - min) + min }
function pick(arr) { return arr[randInt(0, arr.length - 1)] }

function dateStr(d) { return d.toISOString().slice(0, 10) }
function isoStr(d) { return d.toISOString() }

// メーター増分（機械タイプ別の現実的な範囲）
function getIncrements(machineType, price) {
  switch (machineType) {
    case 'SESAME_W':  // セサミ系: 1日100〜600回
      return { inMin: 100, inMax: 600, outRate: [0.03, 0.25] }
    case 'BUZZ':       // Buzz系: 1日50〜400回
      return { inMin: 50, inMax: 400, outRate: [0.05, 0.30] }
    case 'HIGH_GACHA': // ガチャ系: 1日30〜300回
      return { inMin: 30, inMax: 300, outRate: [0.10, 0.40] }
    default:
      return { inMin: 50, inMax: 300, outRate: [0.05, 0.25] }
  }
}

// 曜日による売上補正（土日は1.5倍、平日は0.8〜1.0倍）
function dayMultiplier(date) {
  const dow = date.getDay()
  if (dow === 0) return 1.6  // 日
  if (dow === 6) return 1.5  // 土
  if (dow === 5) return 1.2  // 金
  return 0.7 + Math.random() * 0.3  // 月〜木
}

// 月による売上補正（1月=正月ブースト、3月=春休みブースト）
function monthMultiplier(month) {
  if (month === 0) return 1.3  // 1月（正月）
  if (month === 1) return 0.9  // 2月（閑散期）
  if (month === 2) return 1.2  // 3月（春休み）
  return 1.0
}

// ========================================
// データ生成
// ========================================
function generateData() {
  const rows = []
  const boothStates = {} // full_booth_code -> { in_meter, out_meter, prize_name, set_a, set_c, set_l, set_r, set_o }

  // 初期メーター値を設定（各ブースごとにランダムなスタート値）
  for (const store of STORES) {
    for (const machine of store.machines) {
      for (const booth of machine.booths) {
        const code = `${store.store_code}-${machine.code}-${booth}`
        boothStates[code] = {
          in_meter: randInt(5000, 50000),
          out_meter: randInt(1000, 15000),
          prize_name: pick(PRIZE_NAMES),
          set_a: randInt(3, 15),
          set_c: randInt(20, 40),
          set_l: randInt(10, 25),
          set_r: randInt(15, 30),
          set_o: '',
          prize_stock: randInt(5, 30),
        }
      }
    }
  }

  // 3ヶ月分（2026-01-01 〜 2026-03-18）
  const startDate = new Date('2026-01-01T00:00:00+09:00')
  const endDate = new Date('2026-03-18T00:00:00+09:00')

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    const month = d.getMonth()
    const dayMul = dayMultiplier(d)
    const monthMul = monthMultiplier(month)

    // 各スタッフが担当日にその店舗を巡回
    for (const staff of STAFF) {
      // この日がスタッフの勤務日か？
      if (!staff.daysPerWeek.includes(dow)) continue

      // 担当店舗を巡回
      for (const storeCode of staff.stores) {
        const store = STORES.find(s => s.store_code === storeCode)
        if (!store) continue

        // たまにシフト変更で来ない（reliabilityで制御）
        if (Math.random() > staff.reliability) continue

        // 巡回時刻（10:00〜16:00の間でランダム）
        const hour = randInt(10, 16)
        const minute = randInt(0, 59)
        const readTime = new Date(d)
        readTime.setHours(hour, minute, 0, 0)

        for (const machine of store.machines) {
          const inc = getIncrements(machine.type, machine.price)

          for (const booth of machine.booths) {
            const fullCode = `${store.store_code}-${machine.code}-${booth}`
            const state = boothStates[fullCode]

            // メーター増分計算（曜日・月・ランダム性を考慮）
            let inInc = Math.round(randInt(inc.inMin, inc.inMax) * dayMul * monthMul)
            let outInc = Math.round(inInc * randFloat(inc.outRate[0], inc.outRate[1]))

            // 新人のミス: たまに桁間違い
            let inputIn = state.in_meter + inInc
            let inputOut = state.out_meter + outInc
            let note = ''

            if (Math.random() < staff.errorRate) {
              // 入力ミスパターン
              const errType = randInt(1, 4)
              if (errType === 1) {
                // 1桁間違い（多い）
                inputIn = inputIn + randInt(-5, 5) * 10
                note = ''  // ミスには気づかない
              } else if (errType === 2) {
                // INとOUTを逆に入力
                const tmp = inputIn
                inputIn = inputOut
                inputOut = tmp
                note = ''
              } else if (errType === 3) {
                // OUT入力忘れ
                inputOut = null
                note = ''
              } else {
                // メーター読み間違い（巻き戻り）→ 異常値になる
                inputIn = state.in_meter - randInt(100, 500)
                note = ''
              }
            }

            // 実際のメーター値を更新
            state.in_meter += inInc
            state.out_meter += outInc

            // 景品変更（月1回くらい）
            if (Math.random() < 0.03) {
              state.prize_name = pick(PRIZE_NAMES)
            }

            // 景品補充（週1回くらい）
            let restockCount = ''
            if (Math.random() < 0.15) {
              restockCount = String(randInt(3, 20))
              state.prize_stock += parseInt(restockCount)
            }

            // 景品残数（徐々に減る）
            state.prize_stock = Math.max(0, state.prize_stock - randInt(0, 3))

            // 設定値変更（月2回くらい）
            if (Math.random() < 0.07) {
              state.set_a = Math.max(1, state.set_a + randInt(-3, 3))
            }

            readingCounter++
            const readingId = `R${readTime.getTime()}${String(readingCounter).padStart(4, '0')}`

            rows.push({
              reading_id: readingId,
              booth_id: `${storeCode}_${machine.code}_${booth}`.replace(/-/g, '_'),
              full_booth_code: fullCode,
              read_time: isoStr(readTime),
              in_meter: inputIn != null ? String(inputIn) : '',
              out_meter: inputOut != null ? String(inputOut) : '',
              prize_restock_count: restockCount,
              prize_stock_count: String(state.prize_stock),
              prize_name: state.prize_name,
              input_method: 'manual',
              qr_code: '',
              scan_image: '',
              note: note,
              created_at: isoStr(readTime),
              set_a: String(state.set_a),
              set_c: String(state.set_c),
              set_l: String(state.set_l),
              set_r: String(state.set_r),
              set_o: state.set_o,
              // メタデータ（分析用）
              _staff: staff.name,
              _store: store.store_name,
              _machine: machine.name,
              _price: machine.price,
            })
          }
        }
      }
    }
  }

  return rows
}

// ========================================
// 出力
// ========================================
const data = generateData()

// CSV出力（Sheets投入用）
const CSV_HEADERS = 'reading_id,booth_id,full_booth_code,read_time,in_meter,out_meter,prize_restock_count,prize_stock_count,prize_name,input_method,qr_code,scan_image,note,created_at,set_a,set_c,set_l,set_r,set_o'
const csvLines = [CSV_HEADERS]
for (const r of data) {
  csvLines.push([
    r.reading_id, r.booth_id, r.full_booth_code, r.read_time,
    r.in_meter, r.out_meter, r.prize_restock_count, r.prize_stock_count,
    `"${(r.prize_name||'').replace(/"/g, '""')}"`,
    r.input_method, r.qr_code, r.scan_image,
    `"${(r.note||'').replace(/"/g, '""')}"`,
    r.created_at,
    r.set_a, r.set_c, r.set_l, r.set_r, r.set_o
  ].join(','))
}
writeFileSync('test-data-meter-readings.csv', csvLines.join('\n'), 'utf-8')

// 統計サマリー出力
const stats = {
  total_rows: data.length,
  date_range: `${data[0]?.read_time?.slice(0,10)} 〜 ${data[data.length-1]?.read_time?.slice(0,10)}`,
  by_staff: {},
  by_store: {},
  errors_simulated: data.filter(r => r.note || !r.in_meter || !r.out_meter || (parseInt(r.in_meter) < 0)).length,
}

for (const r of data) {
  stats.by_staff[r._staff] = (stats.by_staff[r._staff] || 0) + 1
  stats.by_store[r._store] = (stats.by_store[r._store] || 0) + 1
}

console.log('\n========================================')
console.log('  ClawOps テストデータ生成完了')
console.log('========================================')
console.log(`  総レコード数: ${stats.total_rows.toLocaleString()}件`)
console.log(`  期間: ${stats.date_range}`)
console.log(`  スタッフ別:`)
for (const [name, count] of Object.entries(stats.by_staff)) {
  console.log(`    ${name}: ${count.toLocaleString()}件`)
}
console.log(`  店舗別:`)
for (const [name, count] of Object.entries(stats.by_store)) {
  console.log(`    ${name}: ${count.toLocaleString()}件`)
}
console.log(`  異常データ（シミュレート）: ${stats.errors_simulated}件`)
console.log(`  出力ファイル: test-data-meter-readings.csv`)
console.log('========================================')

// JSON統計も出力
writeFileSync('test-data-stats.json', JSON.stringify(stats, null, 2), 'utf-8')
