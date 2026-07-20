import AdminHubTilesGrid from '../components/AdminHubTilesGrid'

// J-ADMIN-NAV-BADGE-01 2026-05-30: タイル描画を AdminHubTilesGrid に集約 (準備中バッジ + toast)。
const TILES = [
  { label: '取込',         desc: 'PCH Excel取込 / SGP状態',  path: '/admin/import',                    impl: true  },
  { label: '店舗',         desc: '店舗マスタ管理 (機械/ブース追加もここから)', path: '/admin/masters/store-list', impl: true  },
  { label: '機械登録',     desc: '店舗の実機を追加・編集',  path: '/admin/machines',                  impl: true  },
  // SPEC-MACHINE-MODEL-LINK-ADMIN-HUB-CARD-fix-01 (D-102): D-101 の全店横断 model_id 紐付ページ入口 (機械登録直後=A案)
  { label: '全店機械確認', desc: '全店横断で機種(model_id)紐付・全カラム編集', path: '/admin/machine-links',      impl: true  },
  { label: 'ブース一覧',   desc: 'ブース設定の確認・編集・追加', path: '/admin/booths',                impl: true  },
  { label: '機種',         desc: '機種マスタ (型番) 管理',  path: '/admin/models',                    impl: true  },
  { label: '景品',         desc: '景品マスタ管理',         path: '/admin/masters/prizes',            impl: true  },
  { label: 'ロッカー',     desc: 'ロッカーマスタ管理',     path: '/admin/masters/lockers',           impl: false },
  { label: 'スタッフ',     desc: 'スタッフマスタ管理',     path: '/admin/masters/staff',             impl: true  },
  { label: '取引先',       desc: '取引先マスタ管理',       path: '/admin/masters/suppliers',         impl: true  },
  { label: '区分',         desc: '入替区分マスタ管理',     path: '/admin/masters/categories',        impl: false },
  { label: '設定パターン', desc: '機械設定パターン管理',   path: '/admin/masters/settings-patterns', impl: false },
  { label: '用語マスタ',   desc: '用語・略語マスタ管理',   path: '/admin/glossary',                  impl: true  },
  { label: 'マニュアル',   desc: '機械マニュアル管理',     path: '/admin/manuals',                   impl: true  },
]

export default function AdminMastersHubPage() {
  return <AdminHubTilesGrid tiles={TILES} testid="admin-masters-hub" />
}
