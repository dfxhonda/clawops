# ClawOps

クレーンゲーム運営管理システム。約170台・680ブース規模のゲームセンター運営を、巡回入力・棚卸し・在庫管理・売上分析の4本柱で支えるモバイルファーストWebアプリ。

## これは何？

ゲームセンターの現場スタッフが毎日使う業務アプリ。メーター読み取り、景品補充、在庫移動、棚卸しを端末1つで完結させ、売上やランキングをリアルタイムで確認できる。

主な機能:

- 巡回入力: QRコード読取または手入力でメーター値・景品設定を記録
- 棚卸し: 拠点在庫・担当車在庫のカウントと差異確認
- 在庫管理: 入庫・移管・補充の記録と追跡
- 売上分析: 店舗別・機械別・ブース別の売上ランキングと出率表示
- 集金帳票: 契約ベースの精算管理

## 技術スタック

- フロントエンド: React 19 + React Router v7 + Vite 7
- スタイル: Tailwind CSS + CSS カスタムプロパティ（ダークモード標準）
- バックエンド: Supabase（PostgreSQL + Auth + Edge Functions）
- ホスティング: Vercel
- 言語: JavaScript（JSX）、TypeScript 不使用

## セットアップ

### 前提条件

- Node.js 18 以上
- npm
- Supabase プロジェクト（作成済み）

### 手順

```bash
git clone <リポジトリURL>
cd ClawOps
npm install
cp .env.example .env.local
```

`.env.local` に Supabase の接続情報を記入:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

開発サーバー起動:

```bash
npm run dev
```

テスト実行:

```bash
npm test          # 全テスト1回実行
npm run test:watch # ウォッチモード
```

### 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| VITE_SUPABASE_URL | Supabase プロジェクトURL | ○ |
| VITE_SUPABASE_ANON_KEY | Supabase anon キー（公開用） | ○ |

注意: `service_role` キーはフロントに絶対に置かない。Edge Function 側で自動環境変数として利用される。

## 認証

PIN ベースのスタッフ認証。現場の使いやすさを維持しつつ、サーバー側で照合する設計。

1. ログイン画面でスタッフを選択
2. PIN が設定済みなら入力（未設定なら不要）
3. Edge Function `verify-pin` がサーバー側で bcrypt 照合
4. 成功時に Supabase Auth の JWT セッションを発行
5. 以降の API アクセスは JWT で認証

### ロール

| ロール | できること |
|--------|-----------|
| admin | 全機能。マスター編集、削除、開発ツール |
| manager | 大半の機能。マスター編集可、削除不可 |
| patrol | 巡回入力、棚卸し全般、在庫移動 |
| staff | 基本入力、ダッシュボード閲覧 |

## 画面構成

| 区分 | 画面 | パス |
|------|------|------|
| 共通 | ログイン | `/login` |
| 巡回 | メイン入力 | `/` |
| 巡回 | ダッシュボード | `/dashboard` |
| 巡回 | 機械一覧 | `/machines/:storeId` |
| 巡回 | ブース入力 | `/booth/:machineId` |
| 巡回 | 下書き確認 | `/drafts` |
| 巡回 | 完了 | `/complete` |
| 巡回 | ランキング | `/ranking/:storeId` |
| 巡回 | QRスキャン | `/patrol` |
| 巡回 | 巡回入力 | `/patrol/input` |
| 棚卸し | ダッシュボード | `/inventory` |
| 棚卸し | 入庫確認 | `/inventory/receive` |
| 棚卸し | 在庫移管 | `/inventory/transfer` |
| 棚卸し | 実数カウント | `/inventory/count` |
| 棚卸し | 景品マッチング | `/inventory/match` |
| 管理 | 管理メニュー | `/admin` |
| 管理 | データ検索 | `/datasearch` |
| 管理 | 読み値修正 | `/edit/:boothId` |
| 管理 | 伝票取込 | `/admin/import-slips` |

## デプロイ

Vercel にホスティング。`vercel.json` で SPA 用リライトを設定済み。

```bash
npm run build   # dist/ に出力
```

Vercel ダッシュボードで環境変数（VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY）を設定してデプロイ。

## ディレクトリ構成

```
src/
  lib/
    auth/         session.js（セッション管理 — sessionStorage の唯一の窓口）
    supabase.js   Supabase クライアント初期化
  services/       データ操作レイヤー（auth / readings / masters / inventory / movements / prizes / audit / calc / utils）
    sheets.js     互換エクスポート（旧コード向け）
  features/
    inventory/
      hooks/      useInventoryDashboard.js 等
  pages/          画面コンポーネント
    inventory/    棚卸し系画面
  components/     共通コンポーネント（RoleGuard / LogoutButton / ErrorDisplay / TabBar 等）
  __tests__/      Vitest テスト
public/
  docs/           ポータル HTML（レガシー、段階的に React 側へ移行予定）
docs/
  security/       認証・権限・キーローテーション手順書
tools/            開発ユーティリティ
archive/          旧データ（.gitignore 済み）
```

## セキュリティに関する注意

- RLS（Row Level Security）が全テーブルで有効。ロールに応じたアクセス制御を PostgreSQL レベルで実施
- PIN は bcrypt ハッシュで保存。平文では保持しない
- service_role キーはフロントに存在しない。Edge Function の自動環境変数でのみ使用
- 詳細は `docs/security/` を参照

## 対象テスト店舗

| コード | 店舗名 |
|--------|--------|
| KIK01 | 菊陽 |
| KOS01 | 合志 |
| SIM01 | 下通 |
| MNK01 | 南熊本 |

## ID体系

- store_code: KIK01 形式
- machine_code: M01 形式
- booth_code: B01 形式
- full_booth_code: KIK01-M01-B01 形式

## Sentry有効化 (ヒロさん作業)
1. https://sentry.io でアカウント作成、Platform=React で新規プロジェクト作成
   - 組織onboarding(Welcome画面→組織名)を完了させること
2. DSN取得
   - 新規作成直後の **Configure React SDK** 画面のコード内 `dsn:` の値
   - または **Settings > Projects > [プロジェクト名] > SDK Setup > Client Keys (DSN)**
3. Vercel (dfxhonda) → clawops → **Settings → Environment Variables**
   - Key: `VITE_SENTRY_DSN`
   - Value: 上記DSN
   - Environments: Production + Preview (Development不要)
   - Sensitive: チェック推奨
4. Vercel **Deployments → 最新Production の三点 → Redeploy** で環境変数反映
5. メール通知はデフォルトで有効 (登録メールに自動配信、追加設定不要)

> ntfy速報化は別タスク (#1.5): Sentry Webhook → ntfy変換の Vercel Function は後で実装

## 緊急ロールバック手順
本番で不具合見つかった時、以下3ステップで前の状態に戻す:

1. https://vercel.com/dfxhonda/clawops/deployments を開く
2. 現在 Production タグが付いてるデプロイのひとつ上 (= 一つ前の Production)
   の右端三点メニュー → **Promote to Production**
3. ダイアログで **Promote** をクリック

数秒で現場 (round-0.com / clawops-tau.vercel.app) に反映。
リビルド不要、トラフィック切り替えのみ。

ロールバック後にやること:
- ヒロさんがチャットClaudeに「ロールバックした」と伝える
- チャットClaudeがコミットの何が原因か調査、修正は dev で進める

## Sentry environment タグを production/preview で分けるには (任意)
Vercel → clawops → Settings → Environment Variables に以下を追加:
- Key: `VITE_VERCEL_ENV`
- Value: `$VERCEL_ENV`
- Environments: Production + Preview + Development すべてチェック

追加後 Redeploy すると Sentry の Issues に `production` / `preview` タグが付く。
