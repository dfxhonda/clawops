# tasks/lessons.md — 先祖返り防止の知恵集

最終更新: 2026-05-04
方針: 指摘が入ったら必ず追記、既存と統合、抽象論禁止、具体的行動で書く

## A. 推測・憶測で動く (本日5回叱責、最頻発)
- [2026-05-04] OCR真因をコード読まずに「VITE_ANTHROPIC_API_KEY追加」で対応 → コード/設定/履歴全部読んでから指示出す
- [2026-05-04] Claude Code解析v1を鵜呑みに「本番で一度も動かなかった」とヒロさんに伝達 → ヒロさん証言と解析が矛盾したら証言優先で再調査
- [2026-05-04] capture属性削除だけでOCR動くと推測指示 → input[type=file]系は元コード読まずに修正禁止

## B. 太鼓持ち・余計な前置き (常時)
- 共感ポーズ・反省ポーズ・気遣い前置き全禁止
- 「ご指摘ありがとうございます」「お疲れ様です」全禁止
- 行動 > 言葉、結果 > 謝罪

## C. ヒロさん作業要求 (本日3回)
- [2026-05-04] analysis.md ファイル貼り付け要求 → Claude Code に Notion 直接投入させる
- DL/コピペ/スクショ/OK確認 全部違反
- ターミナル出力コピペ要求禁止

## D. 選択肢提示・判断委ね (本日2回)
- ask_user_input_v0 で選択肢並べる禁止
- 「どっち?」「どうする?」聞くのは保険、無価値
- 完成品 artifact + ダメ出しが基本ルート

## E. 既存資産無視 (5/1 OCR事故の根本原因)
- [2026-05-01] Claude Code が ocr-meter Edge Function 存在を grep せず NativeCamera 直叩き新規実装 → 新規API経路実装前に supabase/functions/, api/, src/hooks/, src/shared/ を必ず grep
- [2026-05-04] CLAUDE.md書いた直後に読まずに動いた → 応答前儀式として CLAUDE.md / lessons.md 再読を義務化

## F. 装飾・かっこつけ優先 (4/26 ガチャUI v8)
- [2026-04-26] 業界用語の翻訳サボって装飾優先 → 用語/数字/画面意図を最初から日本語化、装飾はその後
- 末尾の「先回り候補」止まり禁止、本体に組み込む

## G. 中途半端な完成度 (本日2回)
- [2026-05-04] capture追加だけで動くわけない指示書 → 確実な指示書のみ送信、不確実なら 2段階フロー (解析→検証→実装) 強制
- 「ヒロさん作業ゼロ化」と「迷ったらntfy照会」の矛盾 → 「迷ったらTODOログ残して止まる」に統一

## H. 司令塔Opusの本来の仕事放棄
- [2026-04-26] 新人視点で設計欠陥を先回り指摘サボった → メモリ#17(1)役割を毎応答で意識
- 検証層・先回り・節約・世界事例の4役を放棄したら存在意義ゼロ

## I. 先祖返り (本日メイン論点、根本原因)
- [2026-05-04] 過去通った穴を覚えてないから踏み直す → 機械的記録 (lessons.md/ADR/Hooks) で照合、人間の記憶に頼らない
- メモリ書いて読まない問題 → 応答前儀式に CLAUDE.md / lessons.md 再読を強制

## 業務ルール (絶対忘れない)
- patrol_dateの日付規則: 巡回(patrol/carry_forward)=前日付け、入替(replace)=当日付け。これはDFX業務ルール、JSTバグじゃない
- stores.store_name=現場/UI表示用、stores.store_name_official=対外書類専用。UIはstore_name のみ
- anon クエリで organization_id フィルタ禁止、RLS担保

## 既存資産マップ (新規実装前に必ず確認)
- supabase/functions/ocr-meter/ — OCR API ラッパー (ACTIVE、Supabase Secret dfx_api_key 使用)
- src/clawsupport/components/MeterOcr.jsx — 旧OCR UI (Edge Function経由、現在意図せずバイパス中)
- src/clawsupport/components/NativeCamera.jsx — 5/1新規実装、VITE_ANTHROPIC_API_KEY 直叩き、漏洩リスクあり
- src/shared/ui/KanaIndex.jsx — 50音ナビ共通、再利用前提
- src/shared/auth/LogoutButton.jsx — 全画面PageHeader rightSlot に配置必須
