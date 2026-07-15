import { useEffect, useMemo, useState } from 'react'
import AdminHubTilesGrid from '../components/AdminHubTilesGrid'
import { useAuth } from '../../hooks/useAuth'
import { fetchMyPageUsage } from '../../services/pageUsage'
import { sortTilesByUsage } from '../../lib/pageUsageSort'
import { PAGE_KEY } from '../../constants/pageKeys'

// J-REPORTS-ANALYTICS-01 2026-05-30: 7 集計画面を impl:true に変更、AdminHubTilesGrid 集約。
// SPEC-ANALYTICS-USAGE-SORT-W1-01 (D-068): 各 impl タイルに page_key 付与 + 本人利用実績で自動ソート。
const TILES = [
  { key: PAGE_KEY.FORECAST,            label: '売上予測',           desc: '集金サイクル別の着地予測',      path: '/admin/forecast',              impl: true  },
  { key: PAGE_KEY.BOOTH_RANKING,       label: 'ブース売上ランキング', desc: 'ブース別売上 ベスト/ワースト', path: '/admin/reports/booth-ranking', impl: true  },
  { key: PAGE_KEY.PAYOUT_TREND,        label: '払い出し率トレンド',   desc: 'ブース別 payout_rate 時系列',  path: '/admin/reports/payout-trend',  impl: true  },
  { key: PAGE_KEY.DMA7,                label: '7日移動平均分析',     desc: '7DMA play_count 多系列折れ線',  path: '/admin/reports/7dma',          impl: true  },
  { key: PAGE_KEY.PRIZE_COST_RECOVERY, label: '景品コスト回収',       desc: '景品別の回収率ランキング',      path: '/admin/reports/prize-cost',    impl: true  },
  { key: PAGE_KEY.STORE_COMPARE,       label: '店舗間比較',           desc: '店舗別 売上/ブース 単価比較',    path: '/admin/reports/store-comparison', impl: true  },
  { key: PAGE_KEY.PROFIT_CALENDAR,     label: '利益率カレンダー',     desc: '日次粗利率ヒートマップ',        path: '/admin/reports/profit-calendar', impl: true  },
  // 旧未実装タイル (spec で touch 指示なし、残置。準備中 = ソート対象外・下部固定)
  { label: '日次ブース', desc: 'ブース単位の日次集計',   path: '/admin/reports/daily-booths',   impl: false },
  { label: '時別ブース', desc: 'ブース単位の時別集計',   path: '/admin/reports/hourly-booths',  impl: false },
  { label: '日次機械',   desc: '機械単位の日次集計',     path: '/admin/reports/daily-machines', impl: false },
  { key: PAGE_KEY.COLLECTION_EXPORT, label: '集金抽出', desc: '集金データのxlsx出力', path: '/admin/reports/collections', impl: true  },
  { label: '課金',       desc: '課金レポート一覧',       path: '/admin/reports/billing',        impl: false },
]

export default function AdminReportsHubPage() {
  const { staffId } = useAuth()
  const [statsByKey, setStatsByKey] = useState({})

  useEffect(() => {
    let cancel = false
    // 失敗時も {} で既定順 (ソートがハブ表示をブロックしない)
    fetchMyPageUsage(staffId).then(m => { if (!cancel) setStatsByKey(m) })
    return () => { cancel = true }
  }, [staffId])

  const tiles = useMemo(() => sortTilesByUsage(TILES, statsByKey), [statsByKey])

  return <AdminHubTilesGrid tiles={tiles} testid="admin-reports-hub" />
}
