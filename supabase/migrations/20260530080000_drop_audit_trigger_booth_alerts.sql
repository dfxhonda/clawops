-- J-PATROL-99_adhoc_alert_save_failure-fix-02-A (2026-05-30 ヒロ承認)
-- booth_alerts は informational alert (景品不足/入替検討/機械不調/要確認) で、
-- 改ざん追跡 chain-hash まで必要ない。AFTER INSERT/UPDATE/DELETE で発火する
-- log_to_audit_log() trigger が散発的に 8s 超過し authenticated role の
-- statement_timeout に引っかかって HTTP 500 を返す事象を本番で観察。
-- trigger 削除で INSERT 経路を最短化、失敗リスクを根本解消。
-- 必要なら application 側 services/audit.js 経由で別途記録できる。

DROP TRIGGER IF EXISTS trg_audit_log ON public.booth_alerts;
