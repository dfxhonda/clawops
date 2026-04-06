# ClawOps

**正式名称:** クレーンゲーム運営管理システム
**Status:** Phase A 稼働中 / Phase B 完了
**GitHub:** dfxhonda/clawops (main branch)
**Vercel:** デプロイ済み
**最新commit:** 797947b (2026-04-05)

## 規模
- 約170台 / 約680ブース / 将来100店舗超え想定
- テスト店舗4店: KIK01, KOS01, SIM01, MNK01
- スタッフ11名（うちPIN設定済み2名: 坂本社長 STAFF-01, 本田 STAFF-03）

## アーキテクチャ
- React SPA（TypeScript不使用、JSXのみ）
- Supabase PostgreSQL + RLS + Edge Functions
- sessionStorageベースの認証（JWT）
- モバイルファースト（ダークモードデフォルト）

## ディレクトリ構成（2026-04-05時点）
```
src/
├── hooks/          ← NEW: カスタムフック群
│   ├── useAuth.js
│   ├── useAsync.js
│   ├── useToast.jsx
│   ├── useDrafts.js
│   ├── useMeterCalc.js
│   ├── useMainInput.js
│   ├── useBoothInput.js
│   └── usePatrolInput.js
├── lib/auth/session.js   ← セッション管理の唯一の窓口
├── lib/supabase.js
├── services/       ← データアクセス層
│   ├── sheets.js (互換ラッパー)
│   ├── readings.js, masters.js, inventory.js
│   ├── movements.js, prizes.js, audit.js
│   ├── calc.js (純粋関数)
│   └── utils.js
├── components/     ← 共通UI
│   ├── ProtectedRoute.jsx (認証+ロール統合)
│   ├── ErrorBoundary.jsx, ErrorDisplay.jsx
│   ├── RoleGuard.jsx, TabBar.jsx
│   ├── LogoutButton.jsx, NumberInput.jsx
├── pages/          ← ページコンポーネント(view層)
│   └── inventory/  ← 棚卸し5画面
├── features/inventory/hooks/
└── __tests__/      ← Vitest (69テスト)
```

## 完了済みフェーズ
### Phase A: 巡回入力アプリ
- メーター入力（MainInput / BoothInput / PatrolInput）
- QRスキャン巡回
- ドラフト→一括送信フロー
- 棚卸し（入庫・移管・実査・照合）
- ランキング・データ検索
- UI/UXモバイル最適化（タッチ44px・バッジ12px）

### Phase B: 開発者改善（Issues #2-#11）
- #2: セッション管理レイヤー統一 ✅
- #3: useAuth + ProtectedRoute/RoleRoute ✅
- #4: useInventoryDashboard フック抽出 ✅
- #6: 純粋関数（calc.js）追加 ✅
- #7: Vitest テスト基盤 ✅
- #8: ルート整理 ✅
- #9: README更新 ✅
- #10: CHANGELOG更新 ✅
- Phase B追加: 3大ページのフック抽出 ✅
  - MainInput 553→343行, BoothInput 490→301行, PatrolInput 257→185行

## Phase B追加: コードスプリット (c382c71)
- React.lazy + Suspense で全ページ遅延読み込み
- manualChunks: vendor(47KB) / supabase(191KB) / qrscanner(334KB)
- 初回ロード: **941KB → 219KB (77%削減、gzip 68KB)**
- 即時ロード: Login + MainInput のみ

## 未着手 / 次のステップ候補
- features/ ディレクトリへのページ完全移行
- エラーハンドリングの更なる統一（useAsync活用）
- オフライン対応（Service Worker）
- 景品写真管理機能
- ドラフト形式統一（v2オブジェクト vs 配列の2種類が共存）

## 通知設定
```bash
~/scripts/zundamon.sh "メッセージ"   # VOICEVOX音声
curl -d "メッセージ" ntfy.sh/clawops-hiro-0328  # iPhone通知
```
