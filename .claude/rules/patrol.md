# 巡回業務 (v1.0)

## エントリタイプ
- patrol = 通常巡回 (前日付け)
- replace = 入替 (当日付け、景品/設定変更時)
- collection = 集金 (in_meter のみ計測、out=NULL)
- carry_forward = 廃止 (v1.0以降生成停止)

## 計測ルール
- 集金時のみメーター計測、in_meter のみ
- 出率は在庫ベース計算: ((前回stock - 今回stock) + prize_in) / in差分
- 即時UPSERT、確定ボタンなし
- (booth_code, patrol_date) で1レコード収束、触らない値=規定値補完、値変化なし=upsertしない

## 修正/入替モード分岐
- meter_dirty=false → 修正モード (UPDATE + audit_logs)
- meter_dirty=true → 入替モード (replace 新規 INSERT)

## UI
- モーダル廃止、通常フィールド + バナー(text-xs gray-400) + 取消5秒Undo
- 5:00JST cron で auto_finished/abandoned
