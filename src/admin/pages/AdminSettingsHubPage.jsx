import AdminHubTilesGrid from '../components/AdminHubTilesGrid'

// J-ADMIN-NAV-BADGE-01 2026-05-30: AdminHubTilesGrid に集約 (準備中バッジ + toast)。
const TILES = [
  { label: 'Feature Flags',  desc: '機能フラグのON/OFF管理',  path: '/admin/settings/flags',         impl: false },
  { label: '入替提案ルール', desc: '入替判定ルールの設定',     path: '/admin/settings/replace-rules', impl: false },
  { label: 'SGP連携設定',    desc: 'SGPデータ取込の設定',      path: '/admin/settings/sgp',           impl: false },
  // J-DEV-ASSET-HANDOFF-01: 開発資産受け渡し (admin/manager) — RLS で staff/patrol ブロック
  { label: 'ファイル受け渡し', desc: '開発資産 (PNG/xlsx/pdf 等) を bytes 保持で受け渡し', path: '/admin/dev-assets', impl: true },
]

export default function AdminSettingsHubPage() {
  return <AdminHubTilesGrid tiles={TILES} testid="admin-settings-hub" />
}
