# アーキテクチャ決定記録

## データフロー
```
ページ(view) → カスタムフック(logic) → services(API) → Supabase
                                         ↕
                                    sessionStorage(auth/drafts)
```

## 認証フロー
1. Login画面でスタッフ選択 → PIN入力
2. Edge Function verify-pin でbcrypt照合
3. JWT発行 → sessionStorage に保存
4. 以降のAPI呼出しはSupabase JS SDKのauth.setSession()で認証
5. RLS が current_staff_role() / current_staff_id() で行レベル制御

## セッション管理
- 唯一の窓口: src/lib/auth/session.js
- キー: gapi_token, clawops_staff_id, clawops_staff_name, clawops_staff_role
- services/auth.js は再エクスポートラッパー（後方互換）

## ルーティング（src/App.jsx）
- ProtectedRoute: 認証のみ（全ロール）
- AdminRoute: admin のみ
- ManagerRoute: admin + manager
- PatrolRoute: admin + manager + patrol
- RoleGuard: レガシー（ProtectedRouteに統合済みだが残存）

## ドラフトシステム
- MainInput: clawops_drafts_v2（オブジェクト形式 {boothId: data}）
- BoothInput/PatrolInput: clawops_drafts（配列形式 [{booth_id, ...}]）
- 注意: 2つの異なるドラフト形式が共存している（統一候補）

## サービス層
- sheets.js: 全エクスポートの互換ラッパー（新規コードは個別モジュールから直接import推奨）
- readings.js: meter_readings CRUD
- masters.js: stores/machines/booths/locations マスタ
- inventory.js: prize_stocks 操作
- movements.js: stock_movements + 調整
- prizes.js: prize_masters + orders
- calc.js: 純粋関数（売上計算・出率・バリデーション）
- audit.js: 監査ログ
- utils.js: parseNum, キャッシュ

## バンドル構成（c382c71時点）
| チャンク | サイズ | gzip | ロードタイミング |
|----------|--------|------|-----------------|
| index | 219KB | 68KB | 初回（Login+MainInput） |
| vendor | 47KB | 16KB | 初回（React/Router） |
| supabase | 191KB | 50KB | 初回（Auth） |
| qrscanner | 334KB | 99KB | 巡回画面のみ |
| 各ページ | 1-16KB | 1-5KB | 画面遷移時 |

## 既知の技術的負債
1. ドラフト形式が2種類（v2 vs 配列）
2. sheets.js の巨大再エクスポート
3. ErrorDisplay が全ページで使われていない
4. features/ ディレクトリが inventory のみ
5. supabase 191KBがまだ初回ロードに入っている（tree-shakeの余地あり）
