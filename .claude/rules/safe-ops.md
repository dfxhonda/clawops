# ど安定ver5点 — 触る前にヒロさんに打診必須
1. in/outメーター記録 — meter_readings の保存ロジック (clawsupport/, src/clawsupport/components/MeterInputRow*, usePatrolForm.js, patrolV2.js)
2. 集金根拠 — 誰がいつ何を入/出/集金した記録 (audit_logs, meter_readings.entry_type, collection 関連)
3. 景品在庫 — 補充・在庫数の記録 (tanasupport/, stocktake_*, prize_masters)
4. 認証処理 — AuthProvider, useAuth, supabase Auth, RLS policies
5. スキーマ変更 — stocktake_sessions, stocktake_items, staff, stores, prize_masters, meter_readings

## 危険操作 (要事前打診)
- git push --force / tag / release
- 外部通知 API 経路の追加・変更
- データ削除 (storage, DB row, files)
- 本番データ更新 (production env で UPDATE/DELETE)

## devブランチ判定 (以下は dev 必須)
- in/outメーター保存ロジック変更
- スキーマ/RLS/認証処理の変更
- 新規画面・大規模リファクタ

## 業務ルール (絶対忘れない)
- patrol_dateの日付規則: 巡回(patrol/carry_forward)=前日付け、入替(replace)=当日付け
- stores.store_name=現場/UI、stores.store_name_official=対外書類専用、UIはstore_name のみ
- anon クエリで organization_id フィルタ禁止、RLS担保
