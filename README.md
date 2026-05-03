# Round Zero

クレーンゲーム運営管理システム。44店舗規模のゲームセンター運営を、巡回入力・棚卸し・入荷管理・発注追跡の3モジュールで支えるモバイルファーストWebアプリ。

## これは何？

ゲームセンターの現場スタッフが毎日使う業務アプリ。メーター読み取り、景品補充、在庫移動、棚卸しを端末1つで完結させる。

主な機能:

- **クレサポ**: QRコード読取または手入力でメーター値・景品設定を記録、集金帳票管理
- **タナサポ**: 入荷チェック・棚卸しセッション管理・発注追跡
- **管理運営**: スタッフ管理・マスター管理・棚卸し承認

## 技術スタック

- フロントエンド: React 19 + React Router v7 + Vite 7
- スタイル: Tailwind CSS v4 + CSS カスタムプロパティ（ダークモード標準）
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
cd clawops
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

Supabase Auth ベースのスタッフ認証。

1. ログイン画面でスタッフを選択
2. PIN 入力（Edge Function `verify-pin` が bcrypt 照合）
3. 成功時に Supabase Auth の JWT セッションを発行
4. ロールは `session.user.user_metadata.role` から取得
5. `useAuth()` で `{ staffId, staffName, staffRole }` を取得

### ロール

| ロール | できること |
|--------|-----------|
| admin | 全機能。マスター編集・削除・棚卸し承認 |
| manager | 棚卸し承認・入荷確認・発注管理 |
| patrol | 巡回入力・集金・補充記録 |
| staff | 棚卸し入力のみ |

## 画面構成

| モジュール | 画面 | パス |
|-----------|------|------|
| 共通 | ランチャー | `/` |
| 共通 | ログイン | `/login` |
| クレサポ | 概要 | `/patrol/overview` |
| クレサポ | 巡回入力 | `/patrol/input` |
| クレサポ | 集金 | `/collection/:storeCode` |
| タナサポ | ハブ（店舗一覧） | `/tanasupport` |
| タナサポ | 店舗ダッシュボード | `/tanasupport/store/:storeCode` |
| タナサポ | 棚卸しセッション一覧 | `/tanasupport/store/:storeCode/stocktake` |
| タナサポ | 棚卸し入力 | `/tanasupport/store/:storeCode/stocktake/:sessionId` |
| 管理運営 | 管理メニュー | `/admin` |
| 管理運営 | 棚卸しセッション管理 | `/admin/stocktake` |
| 管理運営 | 棚卸しセッション作成 | `/admin/stocktake/create` |
| 管理運営 | 棚卸し承認/却下 | `/admin/stocktake/:sessionId` |

## デプロイ

Vercel にホスティング。`vercel.json` で SPA 用リライトを設定済み。

```bash
npm run build   # dist/ に出力
```

Vercel ダッシュボード で環境変数（VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY）を設定してデプロイ。

- main: https://round-0.com ・ https://clawops-tau.vercel.app
- dev: Vercel が push ごとに Preview URL を生成

## ディレクトリ構成

```
src/
  clawsupport/      クレサポモジュール（巡回・集金・補充）
  tanasupport/      タナサポモジュール（入荷・棚卸し・発注）
    stocktake/      棚卸しサブモジュール
    pages/          タナサポハブ等
  manesupport/      管理運営モジュール
    admin/          管理画面
      stocktake/    棚卸し承認管理
  shared/           モジュール横断共通
    auth/           roles.js（MODULE_ACCESS・LAUNCHER_TILES）
    ui/             PageHeader 等共通コンポーネント
  lib/
    supabase.js     Supabase クライアント初期化
  hooks/            useAuth 等グローバルフック
  services/         データ操作レイヤー
  components/       レガシー共通コンポーネント
  __tests__/        Vitest テスト
```

## セキュリティに関する注意

- RLS（Row Level Security）が全テーブルで有効。ロールに応じたアクセス制御を PostgreSQL レベルで実施
- PIN は bcrypt ハッシュで保存。平文では保持しない
- service_role キーはフロントに存在しない。Edge Function の自動環境変数でのみ使用

## 緊急ロールバック手順

本番で不具合見つかった時:

1. https://vercel.com/dfxhonda/clawops/deployments を開く
2. 一つ前の Production デプロイの右端三点メニュー → **Promote to Production**
3. ダイアログで **Promote** をクリック

数秒で round-0.com に反映。リビルド不要、トラフィック切り替えのみ。
