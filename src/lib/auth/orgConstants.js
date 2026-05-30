// ============================================
// 組織ID定数 + 管理者横断閲覧の暫定スイッチ
// ============================================
// J-PATROL-99_adhoc_admin_cross_org_view (2026-05-30)
// 本格マルチテナント化(B-2)までの暫定。WRITE 経路は DFX_ORG_ID のままで触らず、
// READ 系の組織フィルタだけ「閲覧可能組織配列」に拡張できるようヘルパを提供する。
//
// 想定運用:
// - DFX 合同会社 (ヒロ代表)            : システム管理者、全 org を閲覧
// - 株式会社change (坂本社長)          : 運営会社、九州ドンキ + 福岡その他
// - ナイスランド (小塩社長, 未登録)   : 契約主、沖縄 + 熊本 + 福岡ドンキ
//
// 既存 import (DFX_ORG_ID のみ) はそのまま動く。
// 横断閲覧したい READ 箇所だけ ADMIN_VIEWABLE_ORG_IDS / isAdminUser を使う。

export const DFX_ORG_ID = '14e907a7-65a3-4891-9a3c-20ea0a7c14fd'
export const CHANGE_ORG_ID = '01cf7a5e-6971-4ae1-918d-8e5981780a95'

/**
 * admin / manager が閲覧可能な全 organization_id。
 * .in('organization_id', ADMIN_VIEWABLE_ORG_IDS) で READ クエリに使う。
 * 新組織追加時は本配列に追記する。本格マルチテナント化までの暫定実装。
 */
export const ADMIN_VIEWABLE_ORG_IDS = [DFX_ORG_ID, CHANGE_ORG_ID]

/**
 * 与えられた role が admin か判定する。
 * Supabase Auth user_metadata.role に依存。
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export function isAdminRole(role) {
  return role === 'admin'
}

/**
 * READ クエリ向けの「閲覧可能 organization_id 配列」を返す。
 * - admin の場合: 全閲覧可能 org の配列を返す(横断閲覧)
 * - それ以外: 自組織のみ(currentOrgId が null/undefined の場合は DFX_ORG_ID にフォールバック)
 *
 * @param {object} args
 * @param {string|null|undefined} args.role - ログインユーザの role (admin/manager/patrol/staff)
 * @param {string|null|undefined} args.currentOrgId - ログインユーザの所属 org_id (user_metadata.organization_id)
 * @returns {string[]} organization_id 配列
 */
export function getReadableOrgIds({ role, currentOrgId } = {}) {
  if (isAdminRole(role)) return ADMIN_VIEWABLE_ORG_IDS
  return [currentOrgId || DFX_ORG_ID]
}
