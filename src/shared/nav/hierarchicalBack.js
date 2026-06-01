// J-NAV-BACK-HIERARCHICAL-01 (2026-05-30 ヒロ指示):
// 各画面の左上「← 戻る」ボタンを navigate(-1) (履歴ベース) から
// ルート階層に基づく「一階層上」に切替えるための共通ユーティリティ。
//
// 設計:
//   1) 明示マップ (OVERRIDES) で個別ルートの親パスを定義可能。
//      動的セグメント (`:storeCode` 等) を持つ booth → store のような
//      親 URL に ID が必要なケースは特に明示推奨。
//   2) マップに無い場合は generic rule: 末尾セグメント削除。
//      `/a/b/c` → `/a/b`、ただし 1 セグメントだけなら `/launcher` に戻す。
//   3) 認証外 (/login) や Launcher 自身は戻り先を持たない (`null` 返却)。
//
// 利用側:
//   import { useHierarchicalBack } from '../../shared/nav/hierarchicalBack'
//   const goBack = useHierarchicalBack()
//   <button onClick={goBack}>← 戻る</button>

import { useNavigate, useLocation, useParams } from 'react-router-dom'

const LAUNCHER = '/launcher'

// 明示マップ: pathname (or pattern) → 親 URL を返す関数。
// params 内 (useParams で取れる動的 ID) を使って親 URL に ID を埋め込めるよう
// (pathname, params) を受ける。マッチは patterns 配列を順次評価。
const OVERRIDES = [
  // クレサポ: booth は store の中にいるが URL に store_code が無い → booth_code 先頭で組み立て。
  // ヒロ ad-hoc 2026-06-02 (Discord 1511026322976145638): '戻るで 2 段戻る時ある' bug 修正。
  // booth_code 形式 STORE-Mxx-Bxx の先頭 split('-')[0] = store_code、admin precedent と同手法。
  // split できない場合 (booth_code がフォーマット外) は安全策で /clawsupport トップへフォールバック。
  { test: /^\/clawsupport\/booth\/[^/]+\/?$/, target: (path) => {
      const m = path.match(/^\/clawsupport\/booth\/([^/]+)/)
      const boothCode = m?.[1]
      const storeCode = boothCode?.split('-')?.[0]
      return storeCode && storeCode !== boothCode
        ? `/clawsupport/store/${storeCode}`
        : '/clawsupport'
    } },
  { test: /^\/clawsupport\/store\/[^/]+\/dash\/?$/, target: (_, p) => `/clawsupport/store/${p.storeCode}` },
  { test: /^\/clawsupport\/store\/[^/]+\/patrol\/?$/, target: (_, p) => `/clawsupport/store/${p.storeCode}` },
  { test: /^\/clawsupport\/store\/[^/]+\/?$/, target: () => '/clawsupport' },
  { test: /^\/clawsupport\/alerts\/?$/, target: () => '/clawsupport' },
  { test: /^\/clawsupport\/?$/, target: () => LAUNCHER },

  // タナサポ
  { test: /^\/tanasupport\/store\/[^/]+\/?$/, target: () => '/tanasupport' },
  { test: /^\/tanasupport\/location\/[^/]+\/stocktake\/?$/, target: () => '/tanasupport' },
  { test: /^\/tanasupport\/orders\/?$/, target: () => '/tanasupport' },
  { test: /^\/tanasupport\/stocktake\/?$/, target: () => '/tanasupport' },
  { test: /^\/tanasupport\/?$/, target: () => LAUNCHER },
  { test: /^\/stock\/arrival\/?$/, target: () => '/tanasupport' },
  { test: /^\/stock\/out\/?$/, target: () => '/tanasupport' },

  // 集金
  { test: /^\/collection\/history\/?$/, target: () => '/collection/input' },
  { test: /^\/collection\/input\/?$/, target: () => LAUNCHER },

  // マネサポ (admin) は AdminLayout 内に TopTabs があるのでハブには '← ホーム' (launcher) を残す。
  // 配下ページは親タブに戻す: /admin/masters/X → /admin/masters
  { test: /^\/admin\/masters\/[^/]+\/?$/, target: () => '/admin/masters' },
  { test: /^\/admin\/audit\/booth-edit\/[^/]+\/machines\/?$/, target: () => '/admin/audit/booth-edit' },
  // ヒロ ad-hoc 2026-05-31: ブースデータ編集 → 機械一覧 (旧: 店舗一覧 = 2段戻り bug)。
  // booth_code は STORE-Mxx-Bxx 形式、先頭 split('-')[0] = store_code で機械一覧 URL を組み立て。
  { test: /^\/admin\/audit\/booth-edit\/[^/]+\/?$/, target: (path) => {
      const m = path.match(/^\/admin\/audit\/booth-edit\/([^/]+)/)
      const boothCode = m?.[1]
      const storeCode = boothCode?.split('-')?.[0]
      return storeCode ? `/admin/audit/booth-edit/${storeCode}/machines` : '/admin/audit/booth-edit'
    } },
  { test: /^\/admin\/audit\/[^/]+\/?$/, target: () => '/admin/audit' },
  { test: /^\/admin\/reports\/[^/]+\/?$/, target: () => '/admin/reports' },
  { test: /^\/admin\/settings\/[^/]+\/?$/, target: () => '/admin/settings' },
  { test: /^\/admin\/store\/[^/]+\/machines\/?$/, target: () => '/admin/store-list' },
  { test: /^\/admin\/booth-edit\/[^/]+\/?$/, target: () => '/admin/store-list' },
  { test: /^\/admin\/store-list\/?$/, target: () => '/admin/masters' },
  { test: /^\/admin\/dev-assets\/upload\/?$/, target: () => '/admin/dev-assets' },
  { test: /^\/admin\/(masters|audit|reports|settings|import|collection-flag|labels|alert-types|dev-assets|stocktake|qr-print|glossary|store-list|audit-summary|operation-logs)\/?$/, target: () => '/admin' },
  { test: /^\/admin\/?$/, target: () => LAUNCHER },

  // 旧巡回・編集系
  { test: /^\/patrol\/input\/?$/, target: () => '/clawsupport' },
  { test: /^\/patrol\/booth\/?$/, target: () => '/clawsupport' },
  { test: /^\/patrol\/?$/, target: () => '/clawsupport' },
  { test: /^\/booth\/[^/]+\/?$/, target: () => '/clawsupport' },
  { test: /^\/edit\/[^/]+\/?$/, target: () => '/datasearch' },
  { test: /^\/drafts\/?$/, target: () => '/clawsupport' },
  { test: /^\/complete\/?$/, target: () => '/clawsupport' },
  { test: /^\/ranking\/[^/]+\/?$/, target: () => '/clawsupport' },
  { test: /^\/machines\/[^/]+\/?$/, target: () => '/clawsupport' },

  // その他トップ階層
  { test: /^\/dashboard\/legacy\/?$/, target: () => '/dashboard' },
  { test: /^\/dashboard\/?$/, target: () => LAUNCHER },
  { test: /^\/datasearch\/?$/, target: () => LAUNCHER },
  { test: /^\/help\/?$/, target: () => LAUNCHER },
  { test: /^\/launcher\/?$/, target: () => null },
  { test: /^\/login\/?$/, target: () => null },
]

export function getHierarchicalParent(pathname, params = {}) {
  for (const { test, target } of OVERRIDES) {
    if (test.test(pathname)) {
      return target(pathname, params)
    }
  }
  // generic fallback: 末尾セグメント削除。1 セグメントしか無ければ launcher。
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  if (segments.length <= 1) return LAUNCHER
  return '/' + segments.slice(0, -1).join('/')
}

export function useHierarchicalBack() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const params = useParams()
  return () => {
    const parent = getHierarchicalParent(pathname, params)
    if (parent) navigate(parent)
  }
}
