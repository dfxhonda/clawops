-- SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01-fix-02
-- pre_check: SELECT COUNT(*) FROM prize_masters WHERE status='inactive' AND phase!='dead' = 118 件 (commander 確認済)
-- parent_spec: SPEC-PRIZE-MASTER-STATUS-DEPRECATE-01 (commit 8c3923f) でコード側 .neq('phase','dead') に切替済。
-- DB 側でも整合させる目的、status='inactive' の 118 行を phase='dead' に統一する。
-- forbidden: status 列の DROP / NULL 化 (verify 後の別 spec で対応)

UPDATE prize_masters
   SET phase = 'dead'
 WHERE status = 'inactive'
   AND phase != 'dead';

-- acceptance verify (commander 実行):
-- SELECT COUNT(*) FROM prize_masters WHERE status='inactive' AND phase!='dead'; -- 期待値 0
