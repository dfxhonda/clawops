# 認証

## 権限階層
admin / manager / patrol / staff
- src/shared/auth/roles.js
- useRole hook で取得
- RoleGuard でルート保護

## RLS担保
- staff_stores テーブルで店舗-スタッフ紐付け
- 全クエリは RLS で organization_id 自動絞り
- anon フィルタで organization_id を渡すのは禁止 (RLS違反)
