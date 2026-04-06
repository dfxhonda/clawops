# Glossary

ClawOps プロジェクトの用語・略語・内部言語。

## システム用語
| Term | Meaning | Context |
|------|---------|---------|
| ClawOps | クレーンゲーム運営管理システム | DFX合同会社の自社プロダクト |
| Phase A | 巡回入力アプリ（現在フェーズ） | メーター読取・景品管理 |
| Phase B | 開発者改善（コード品質向上） | フック抽出・テスト・リファクタ |
| RLS | Row Level Security | Supabase PostgreSQLのアクセス制御 |
| メーター | IN/OUTカウンター | クレーンゲーム機のプレイ回数・払出回数 |
| 出率 | OUT差分/IN差分 × 100 | 景品払出率。30%超は赤、5%未満は青 |
| ドラフト | sessionStorageの一時保存 | 送信前の入力データバッファ |
| 巡回 | 店舗内のメーター読取作業 | QRスキャンまたは手動選択 |
| 棚卸し | 景品在庫の実地棚卸 | 入庫・移管・実査・照合の4機能 |
| 車在庫 | スタッフの車に積んだ景品在庫 | owner_type='staff'で管理 |

## ID体系
| Format | Example | Description |
|--------|---------|-------------|
| store_code | KIK01 | 店舗コード（3文字+2桁） |
| machine_code | M01 | 機械コード |
| booth_code | B01 | ブースコード |
| full_booth_code | KIK01-M01-B01 | 完全修飾ブースID |
| staff_id | STAFF-01 | スタッフID |

## 店舗コード
| Code | Store |
|------|-------|
| KIK01 | 菊陽店 |
| KOS01 | 合志店 |
| SIM01 | 下通店 |
| MNK01 | 南熊本店 |

## ロール階層
| Role | Level | Access |
|------|-------|--------|
| admin | 4 | 全機能 |
| manager | 3 | データ検索・修正・棚卸し照合 |
| patrol | 2 | 巡回QR・棚卸し（照合除く） |
| staff | 1 | メーター入力のみ |

## 技術スタック
| Tech | Usage |
|------|-------|
| React 19 | フロントエンド |
| React Router v7 | ルーティング |
| Vite 7 | ビルドツール |
| Tailwind CSS 4 | スタイリング |
| Supabase | DB + Auth + Edge Functions |
| Vercel | ホスティング |
| Vitest | テストフレームワーク |

## Supabase
| Key | Value |
|-----|-------|
| Project ID | gedxzunoyzmvbqgwjalx |
| Region | ap-southeast-2 |
| Auth | Edge Function verify-pin + JWT |

## 略語
| Term | Meaning |
|------|---------|
| GAS | Google Apps Script（使わない方針） |
| SGP | サプライヤー（景品仕入先） |
| A設定 | アシスト回数 |
| C設定 | キャッチ時パワー |
| L設定 | 緩和時パワー |
| R設定 | リターン（復帰時）パワー |
| O設定 | その他固有設定 |
