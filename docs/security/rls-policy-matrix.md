# ClawOps RLS ポリシーマトリクス

## ヘルパー関数

| 関数 | 戻り値 | 説明 |
|------|--------|------|
| `current_staff_role()` | text | JWT の app_metadata.role を返す。未設定時は 'staff' |
| `current_staff_id()` | text | JWT の app_metadata.staff_id を返す |
| `verify_staff_pin()` | json | PIN 照合（Edge Function 専用、SECURITY DEFINER） |

## ポリシー一覧

### マスターテーブル（参照系）

| テーブル | anon SELECT | auth SELECT | auth INSERT | auth UPDATE | auth DELETE | 変更権限 |
|----------|-------------|-------------|-------------|-------------|-------------|----------|
| stores | ○ | ○ | admin/manager | admin/manager | × | admin/manager |
| machines | ○ | ○ | admin/manager | admin/manager | × | admin/manager |
| booths | ○ | ○ | admin/manager | admin/manager | × | admin/manager |
| machine_categories | ○ | ○ | admin | admin | admin | admin |
| operators | ○ | ○ | admin | admin | admin | admin |
| ownership_types | ○ | ○ | admin | admin | admin | admin |
| patrol_statuses | ○ | ○ | admin | admin | admin | admin |
| transfer_types | ○ | ○ | admin | admin | admin | admin |
| suppliers | × | ○ | admin/manager | admin/manager | admin/manager | admin/manager |
| locations | × | ○ | admin/manager | admin/manager | admin/manager | admin/manager |

### 業務データテーブル

| テーブル | anon | auth SELECT | auth INSERT | auth UPDATE | auth DELETE |
|----------|------|-------------|-------------|-------------|-------------|
| meter_readings | × | ○ | 全ロール | admin/manager | admin のみ |
| prize_stocks | × | ○ | patrol以上 | patrol以上 | × |
| stock_movements | × | ○ | patrol以上 | × | × |
| prize_masters | × | ○ | admin/manager | admin/manager | × |
| prize_orders | × | ○ | admin/manager | admin/manager | × |
| prize_announcements | × | ○ | admin/manager | admin/manager | admin/manager |

### 管理テーブル

| テーブル | anon | auth SELECT | auth INSERT/UPDATE/DELETE |
|----------|------|-------------|--------------------------|
| billing_events | × | ○ | admin/manager |
| billing_snapshots | × | ○ | admin/manager（INSERT のみ） |
| billing_contracts | RLS有効・ポリシー未設定 | 要追加 | 要追加 |
| sgp_import_logs | × | × | admin のみ |
| sgp_zaiko_changes | × | × | admin のみ |
| sgp_zaiko_snapshot | × | × | admin のみ |
| inventory_migration_decisions | × | × | admin/manager |

### 認証テーブル

| テーブル | anon | auth SELECT | auth INSERT/UPDATE/DELETE |
|----------|------|-------------|--------------------------|
| staff | × | 自分のレコードのみ | service_role のみ |
| staff_public (VIEW) | ○ | ○ | ビューのため変更不可 |
| staff_stores | RLS有効・ポリシー要確認 | 要確認 | 要確認 |
| auth_logs | × | × | service_role のみ |

## 残課題

- `billing_contracts`: ポリシー未設定。admin/manager の SELECT/INSERT/UPDATE を追加すべき
- `staff_stores`: ポリシー確認が必要
- `booth_prize_stocks`: ポリシー確認が必要
- `booth_setting_patterns`: ポリシー確認が必要
- 各テーブルの残りポリシー（daily_booth_stats, hourly_booth_stats 等）の追加
- capsule 系テーブル（capsule_materials, capsule_orders, capsule_stocks）のポリシー追加
