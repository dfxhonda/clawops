# audit_log trigger適用状況レポート (T3d-audit_log-coverage-check)

実施日: 2026-05-18  
spec_id: T3d-audit_log-coverage-check  
DB: gedxzunoyzmvbqgwjalx (ap-southeast-2)

---

## 1. 調査結果

### 期待テーブル12本 vs 実在テーブル

| テーブル | DB存在 | trigger適用前 | trigger適用後 | 備考 |
|---|---|---|---|---|
| meter_readings | ○ | ○ | ○ | 既存 |
| stores | ○ | ○ | ○ | 既存 |
| booths | ○ | ○ | ○ | 既存 |
| prize_masters | ○ | ○ | ○ | 既存 |
| machines | ○ | **×** | **○** | 今回追加 |
| staff | ○ | **×** | **○** | 今回追加 |
| machine_models | ○ | **×** | **○** | 今回追加 |
| suppliers | ○ | **×** | **○** | 今回追加 |
| collections | × | - | - | テーブル未存在 (別spec待ち) |
| replacements | × | - | - | テーブル未存在 (別spec待ち) |
| alert_types | × | - | - | AJ-PATROL-ALERTS-HUB-01 待ち |
| booth_alerts | × | - | - | AJ-PATROL-ALERTS-HUB-01 待ち |

### 適用結果サマリー

- 既存テーブルで trigger あり: 4テーブル (meter_readings, stores, booths, prize_masters)
- 今回追加: **4テーブル** (machines, staff, machine_models, suppliers)
- DB未存在 (他spec待ち): 4テーブル (collections, replacements, alert_types, booth_alerts)

---

## 2. Migration

ファイル: `supabase/migrations/20260518120000_add_audit_log_triggers_machines_staff_models_suppliers.sql`

```sql
CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON machines
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();

CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();

CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON machine_models
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();

CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
```

---

## 3. 検証結果

### trigger適用確認 (information_schema.triggers)

| テーブル | INSERT | UPDATE | DELETE |
|---|---|---|---|
| booths | ○ | ○ | ○ |
| machine_models | ○ | ○ | ○ |
| machines | ○ | ○ | ○ |
| meter_readings | ○ | ○ | ○ |
| prize_masters | ○ | ○ | ○ |
| staff | ○ | ○ | ○ |
| stores | ○ | ○ | ○ |
| suppliers | ○ | ○ | ○ |

全8テーブル × 3イベント = 24エントリ 確認済み

### audit_logs テーブル状態

- 総レコード数: 404件
- 最終記録: 2026-05-10 11:02:23 UTC

---

## 4. 残課題

| テーブル | 状態 | アクション |
|---|---|---|
| collections | テーブル未存在 | 別spec (patrol entry_type分離) 完了後にtrigger追加 |
| replacements | テーブル未存在 | 同上 |
| alert_types | テーブル未存在 | AJ-PATROL-ALERTS-HUB-01 完了後にtrigger追加 |
| booth_alerts | テーブル未存在 | AJ-PATROL-ALERTS-HUB-01 完了後にtrigger追加 |

---

*生成: T3d-audit_log-coverage-check / Claude Sonnet 4.6 / 2026-05-18*
