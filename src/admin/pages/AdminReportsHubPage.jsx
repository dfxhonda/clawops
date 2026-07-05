import AdminHubTilesGrid from '../components/AdminHubTilesGrid'

// J-REPORTS-ANALYTICS-01 2026-05-30: 7 集計画面を impl:true に変更、AdminHubTilesGrid 集約。
// 旧 5 タイル (日次/時別/集金抽出/課金) は spec で削除指示なしのため残置、未実装で「準備中」維持。
const TILES = [
  { label: '売上予測',           desc: '集金サイクル別の着地予測',      path: '/admin/forecast',              impl: true  },
  { label: 'ブース売上ランキング', desc: 'ブース別売上 ベスト/ワースト', path: '/admin/reports/booth-ranking', impl: true  },
  { label: '払い出し率トレンド',   desc: 'ブース別 payout_rate 時系列',  path: '/admin/reports/payout-trend',  impl: true  },
  { label: '7日移動平均分析',     desc: '7DMA play_count 多系列折れ線',  path: '/admin/reports/7dma',          impl: true  },
  { label: '景品コスト回収',       desc: '景品別の回収率ランキング',      path: '/admin/reports/prize-cost',    impl: true  },
  { label: '店舗間比較',           desc: '店舗別 売上/ブース 単価比較',    path: '/admin/reports/store-comparison', impl: true  },
  { label: '利益率カレンダー',     desc: '日次粗利率ヒートマップ',        path: '/admin/reports/profit-calendar', impl: true  },
  // 旧未実装タイル (spec で touch 指示なし、残置)
  { label: '日次ブース', desc: 'ブース単位の日次集計',   path: '/admin/reports/daily-booths',   impl: false },
  { label: '時別ブース', desc: 'ブース単位の時別集計',   path: '/admin/reports/hourly-booths',  impl: false },
  { label: '日次機械',   desc: '機械単位の日次集計',     path: '/admin/reports/daily-machines', impl: false },
  { label: '集金抽出',   desc: '集金データのxlsx出力',   path: '/admin/reports/collections',    impl: true  },
  { label: '課金',       desc: '課金レポート一覧',       path: '/admin/reports/billing',        impl: false },
]

export default function AdminReportsHubPage() {
  return <AdminHubTilesGrid tiles={TILES} testid="admin-reports-hub" />
}
