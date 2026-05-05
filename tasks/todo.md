# ロードマップ再構築 — 仕様書 v3.0 準拠（2026-05-05 更新）

---

## ✅ 完了済み（2026-05-05 更新）

- [x] OCR v2 — NativeCamera廃止、OcrCaptureScreen 4フェーズ化（idle→cropping→processing→confirming）
- [x] ロード高速化 Phase A — getLastReadingsMap N+1解消、MachineList booth fetch削除
- [x] KanaIndex+★ハブ（Phase 1.4 完了、ADR-002）
- [x] ocr-meter Edge Function 経路復旧（ADR-003）
- [x] PatrolPage v3 D1/D2 ガチャ対応
- [x] 巡回 play_price パイプライン（Phase 1 全項目）
- [x] getBoothHistory 先頭レコードバグ修正
- [x] **OCR 認識率改善 (2026-05-05)**:
  - 固定クロップ枠（90%×45% 中央）で撮影＝MeterGuideFrame 範囲だけを OCR に送信
  - フラッシュ強制 ON（torch constraint、対応端末のみ／非対応は無音スキップ）
  - 二値化を固定 threshold 128 → Otsu 自動閾値に変更（照明変動に耐性）
  - 純粋関数 `src/lib/ocrPreprocess.js` に切り出し＋単体テスト 11ケース

---

## Phase N: N章 OCR 残作業（DB 計測基盤）

> 画面側の主要改善は 2026-05-05 で完了。残りは認識率の効果測定のための DB 列追加のみ。

- [x] N-3: meter_readings に `ocr_attempted_at`, `ocr_raw_text` 列追加（Supabase migration）
  - 目的: クロップ＋Otsu 化後の認識率を実測してチューニングする基盤
  - Edge Function `ocr-meter` の戻り値を保存し、後でしきい値や前処理を比較できるようにする
- [x] N-4: OcrCaptureScreen → PatrolPage 確定後に MeterInputRow へ値プリセット済みであること確認
  - `handleOcrApply` で inMeter/outMeter/outMeter2 を setPatrolIn/setPatrolOut に正しく渡すことを確認 ✅

---

## Phase B: ロード高速化 Phase B（短期）

> Phase A では MachineList を直した。残り2箇所の全件キャッシュを置換

- [x] `RankingView.jsx`: `getAllMeterReadings()` → `fetchReadingsByBoothIds(boothCodes)` に置換
- [x] `Dashboard.jsx` (manesupport): `getAllMeterReadings()` → ターゲットクエリに置換
- [x] `useMainInput.js`: `getAllMeterReadings()` 呼び出しの重複 fetch を整理

---

## Phase F: 共通 UI コンポーネント（F章準拠）

- [x] `src/shared/ui/DateTime.jsx` 作成（F-6 仕様: `<DateTime value={d} format="full|date|time" />`）
  - `full`: 「M/D(曜) HH:MM」
  - `date`: 「M/D(曜)」
  - `time`: 「HH:MM」
  - JST強制（Asia/Tokyo）
- [ ] 既存画面の日付テキスト直書きを DateTime.jsx に差し替え（F-6 "全テキスト取り回し禁止"）
- [ ] F-7 ダメ出しケース巡回：text-[10px] 以下 / タップ44px未満 / 行間過剰 を検出・修正

---

## Phase L: Hooks 4本（L章機械的強制）✅ 2026-05-05 完了

- [x] L-1: `pre-write-check.sh` — .env*ファイル / VITE_*=sk-* を deny、ど安定ver5点ファイル警告
- [x] L-2: `post-commit-todo.sh` — git commit 後に TODO/FIXME/HACK/XXX 件数チェック
- [x] L-3: `stop-check.sh` — Stop Hook でアンチパターン（「おそらく」等）を検知
- [x] L-4: `lessons-sync.sh` — staged diff と lessons.md パターンを照合

実装ファイル: `.cursor/hooks.json` + `.cursor/hooks/{pre-write-check,post-commit-todo,stop-check,lessons-sync}.sh`

---

## Phase 1.5–1.7: H章 実装順序（中期）

- [x] **1.5** 店舗ダッシュ画面 `/clawsupport/store/:storeId`
  - ClawsupportStoreDash.jsx で実装済み：4タイル、進捗サマリ、準備中トースト ✅
- [x] **1.6** 既存パトロール画面を店舗ダッシュに接続
  - `/clawsupport/store/:storeId/patrol` 正規パスは接続済み ✅
  - `/patrol/overview` → `/clawsupport` へリダイレクト ✅（PatrolOverview 廃止）
- [ ] **1.7** タナサポ店舗ダッシュ設計・実装
  - 棚卸し画面を `/tanasupport/store/:storeCode/stocktake/:sessionId` に整合
  - 入荷チェック（v1.4 module）の設計書作成

---

## v1.x modules（J-4、機能単位追加）

各 module は `feature_flags` テーブルで flag_key 管理（J章原則4）

- [ ] **集金 v1.1**: 入金出金記録、集金期限管理（コア巡回を参照するだけ）
- [ ] **入替 v1.2**: 景品交換記録の正式モジュール化（現状は entry_type='replace' のみ）
- [ ] **保管場所 v1.3**: `storage_locations` テーブル追加（棚卸し v1.3、司令塔打診必須）
- [ ] **入荷チェック v1.4**: 未受け取り景品チェック（独立モジュール）
- [ ] **今日の状態ダッシュ v1.5**: 全店舗一覧と進捗（コア巡回+棚卸しを参照）

---

## Feature Flags 基盤（J章原則4、v1.x 追加前提）

- [x] `feature_flags` テーブル作成（supabase/migrations/20260505001000_add_feature_flags.sql）
- [x] `src/hooks/useFeatureFlag.js` 作成（Supabase参照 + Kill Switch対応）
- [x] Vercel 環境変数 `VITE_FF_KILL_<FLAG_KEY_UPPER>=true` Kill Switch 対応
- [x] ど安定ver5点を Feature Flag でガード（PatrolPage + BoothInput の handleSave に patrol_core チェック追加）

---

## D章 巡回フロー v2（大規模・要設計）

> 現在の「保存ボタン方式」から「即時UPSERT方式」への移行。
> **司令塔Opus と仕様確定してから実装開始**

- [ ] 巡回 v2 仕様書作成（Notion ADR）
  - patrol_session_id + booth_id = 1レコード収束
  - 確定ボタン廃止、値変化時に即 UPSERT
  - 触ってない値 = 規定値補完
  - Undo バナー（5秒以内）
- [ ] DB: `patrol_sessions` テーブル、`meter_readings` に `patrol_session_id` 追加
- [ ] PatrolPage リアクティブ UPSERT 実装
- [ ] Vitest TDD（ど安定ver5点のリグレッションテスト先行）

---

## ロード高速化 Phase C（長期）✅ 2026-05-05 完了

- [x] Supabase RPC `get_last_readings_per_booth` 追加（ROW_NUMBER 最新2件/ブース）
- [x] `get_last_readings_by_store` RPC 追加（DISTINCT ON で1クエリ、店舗レベル）
- [x] `getAllMeterReadings()` を services/index.js 公開 API から廃止
- [x] `getLastReadingsMap()` を全件取得 → RPC 最適化版に置換

---

## 凍結（現時点でスコープ外）

以下は J-2「v1.0 に入れないもの」として凍結：

- オフライン対応（IndexedDB + Background Sync）
- バーコードスキャン
- 写真 OCR（PatrolBatchOcrPage 以外）
- ラズパイ自動メーター取得
- LINE 通知
- 全社展開・SaaS 化

---

## 判断メモ

- **D章即時UPSERT**: 現行の保存ボタン方式は業務的には問題ない。仕様と乖離はあるが、ADR 確定まで現行維持。
- **OCR 画面比率**: 上1/3カメラ+中段+下1/3 numpad は 2026-05-04 にユーザーと Cursor で確定済み。今後触らない。
- **OCR 認識率の次の一手**: N-3（DB 計測基盤）→ 効果測定 → 必要なら preprocess 再チューニング。「とりあえず処理を強くする」のではなく実測ベースで進める。
- **Phase L Hooks**: CLAUDE.md wish list を Hook に焼く作業。L-3/L-4 が最優先（先祖返り防止）。
- **Phase 1.5 店舗ダッシュ**: KanaIndex ハブ→店舗ダッシュ→巡回 の 3ステップが業界標準（C章）。現状は KanaIndex から直接 PatrolOverview なので 1.5→1.6 は接続作業。
