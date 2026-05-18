# UI/IA監査レポート (T4a-UI-IA-audit)

生成日: 2026-05-18  
spec_id: T4a-UI-IA-audit  
対象: src/clawsupport/pages, src/manesupport/pages, src/admin/pages, src/tanasupport/pages, src/dashboard/pages, src/pages

---

## 1. サマリー

| 項目 | 結果 |
|---|---|
| 評価画面数 | 66 |
| 7項目平均達成率 | **45.4%** |

### 7項目達成率

| # | チェック項目 | ○ | × | 達成率 |
|---|---|---|---|---|
| 1 | 戻るボタン | 57 | 9 | 86.4% |
| 2 | エラー表示 | 47 | 19 | 71.2% |
| 3 | loading表示 | 52 | 14 | 78.8% |
| 4 | 空状態表示 | 38 | 28 | 57.6% |
| 5 | パンくずリスト | 0 | 66 | **0%** |
| 6 | タップターゲット>=44px | 9 | 57 | 13.6% |
| 7 | 保存未完了離脱ダイアログ | 3 | 63 | **4.5%** |

### ワースト3画面 (未達成項目数)

| 順位 | ファイル | 未達成 | 内訳 |
|---|---|---|---|
| 1 | AdminPlaceholderPage.jsx | 6/7 | 戻る×, エラー×, loading×, 空状態×, パンくず×, 離脱× |
| 2 | AdminLoginLogsPage.jsx | 5/7 | 戻る×, パンくず×, 44px×, 離脱×, (エラー/loading/空状態は○) |
| 3 | AdminMasterMachinePage.jsx | 5/7 | 戻る×, パンくず×, 44px×, 離脱× |

---

## 2. 画面別評価テーブル

凡例: ○=実装あり ×=なし

### clawsupport

| route | file | 戻る | エラー | loading | 空状態 | パンくず | 44px | 離脱確認 |
|---|---|---|---|---|---|---|---|---|
| /clawsupport | ClawsupportHub.jsx | ○ | × | ○ | × | × | × | × |
| /clawsupport/store/:code | ClawsupportStoreDash.jsx | ○ | × | ○ | × | × | × | × |
| /clawsupport/booth/input | BoothInput.jsx | ○ | ○ | × | × | × | × | × |
| /clawsupport/machines | MachineList.jsx | ○ | × | ○ | × | × | × | × |
| /clawsupport/complete | Complete.jsx | ○ | ○ | × | ○ | × | × | × |
| /clawsupport/drafts | DraftList.jsx | ○ | ○ | × | ○ | × | × | × |
| /clawsupport/input | MainInput.jsx | ○ | ○ | ○ | × | × | × | × |
| /clawsupport/ocr-test | OCRTestPage.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /clawsupport/batch-ocr | PatrolBatchOcrPage.jsx | ○ | ○ | ○ | × | × | × | × |
| /clawsupport/booth/:code | PatrolBoothInputPage.jsx | ○ | ○ | × | × | × | ○ | × |
| /clawsupport/beta/booth/:code | PatrolBoothInputPageBeta.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /clawsupport/camera | PatrolCameraPage.jsx | ○ | ○ | ○ | × | × | × | × |
| /patrol/input | PatrolInput.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /patrol/machines/:store | PatrolMachineListPage.jsx | ○ | × | ○ | ○ | × | ○ | × |
| /patrol | PatrolOverview.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /patrol/input/:booth | PatrolPage.jsx | ○ | ○ | ○ | × | × | × | × |
| /patrol/scan | PatrolScan.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /clawsupport/store/:code/patrol | PatrolScreenV1.jsx | ○ | × | ○ | ○ | × | × | × |
| /clawsupport/beta/store/:code | PatrolStorePage.jsx | ○ | × | ○ | ○ | × | ○ | × |
| /ranking/:store | RankingView.jsx | ○ | × | ○ | × | × | × | × |

### manesupport

| route | file | 戻る | エラー | loading | 空状態 | パンくず | 44px | 離脱確認 |
|---|---|---|---|---|---|---|---|---|
| /admin/glossary | AdminGlossary.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /admin/menu | AdminMenu.jsx | ○ | × | × | × | × | × | × |
| /admin | AdminTop.jsx | ○ | × | × | × | × | × | × |
| /audit-log | AuditLog.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /audit-summary | AuditSummary.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /booth-list | BoothList.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /booth-qr | BoothQrPrint.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /daily-stats | DailyStatsAdmin.jsx | ○ | ○ | ○ | × | × | × | × |
| /admin/dashboard | Dashboard.jsx | ○ | × | ○ | ○ | × | × | × |
| /datasearch | DataSearch.jsx | ○ | ○ | ○ | ○ | × | × | ○ |
| /edit-reading | EditReading.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /import-slips | ImportSlips.jsx | ○ | ○ | × | × | × | × | × |
| /lockers | LockerList.jsx | ○ | ○ | ○ | ○ | × | × | ○ |
| /machines-mane | MachineList.jsx | ○ | ○ | ○ | ○ | × | × | ○ |
| /manual-editor | ManualEditor.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /manual-view | ManualView.jsx | ○ | ○ | ○ | × | × | × | × |
| /models | ModelList.jsx | ○ | ○ | ○ | ○ | × | × | ○ |
| /setup-sheets | SetupSheets.jsx | ○ | ○ | × | × | × | × | × |
| /test-data | TestDataImport.jsx | ○ | ○ | ○ | ○ | × | × | × |

### admin/pages

| route | file | 戻る | エラー | loading | 空状態 | パンくず | 44px | 離脱確認 |
|---|---|---|---|---|---|---|---|---|
| /admin/audit-hub | AdminAuditHubPage.jsx | ○ | × | × | × | × | × | × |
| /admin/booth-edit | AdminBoothEditPage.jsx | ○ | ○ | ○ | ○ | × | × | ○ |
| /admin/login-logs | AdminLoginLogsPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/machine-layout | AdminMachineLayoutPage.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /admin/machines | AdminMachineListPage.jsx | ○ | × | ○ | ○ | × | ○ | × |
| /admin/models | AdminMasterMachinePage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/masters | AdminMastersHubPage.jsx | ○ | × | × | × | × | × | × |
| /admin/operation-logs | AdminOperationLogsPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/order-history | AdminOrderHistoryPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/placeholder | AdminPlaceholderPage.jsx | × | × | × | × | × | ○ | × |
| /admin/prizes | AdminPrizeMasterPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/prize-history | AdminPrizePhaseHistoryPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/qr-label | AdminQRLabelPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/reports | AdminReportsHubPage.jsx | ○ | × | × | × | × | × | × |
| /admin/settings | AdminSettingsHubPage.jsx | ○ | × | × | × | × | × | × |
| /admin/staff | AdminStaffListPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/stock | AdminStockMovementsPage.jsx | × | ○ | ○ | ○ | × | × | × |
| /admin/stores | AdminStoreListPage.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /admin/store-edit | AdminStorePage.jsx | ○ | × | ○ | ○ | × | × | × |
| /admin/suppliers | AdminSupplierPage.jsx | ○ | ○ | ○ | ○ | × | × | × |

### tanasupport / dashboard / others

| route | file | 戻る | エラー | loading | 空状態 | パンくず | 44px | 離脱確認 |
|---|---|---|---|---|---|---|---|---|
| /orders | OrderList.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /stock/count | StockCount.jsx | ○ | ○ | ○ | ○ | × | × | ○ |
| /stock/dashboard | StockDashboard.jsx | ○ | ○ | ○ | ○ | × | × | × |
| /stock/move | StockMove.jsx | ○ | ○ | ○ | × | × | × | × |
| /stocktake/count | StocktakeCount.jsx | ○ | × | ○ | ○ | × | × | ○ |
| /stocktake/login | StocktakeLogin.jsx | ○ | ○ | × | × | × | × | × |
| /stocktake/summary | StocktakeSummary.jsx | ○ | × | ○ | × | × | × | × |
| /stocktake | StocktakeTop.jsx | ○ | ○ | × | × | × | × | × |
| /tana | TanasupportHub.jsx | ○ | ○ | ○ | × | × | × | × |
| /dashboard | DashboardTop.jsx | ○ | ○ | ○ | × | × | × | × |
| /help | HelpPage.jsx | ○ | × | ○ | ○ | × | × | × |
| /launcher | Launcher.jsx | ○ | × | ○ | × | × | ○ | × |
| /login | Login.jsx | ○ | ○ | × | ○ | × | ○ | × |

---

## 3. ナビゲーション使用状況 Top10

| パターン | 主な用途 | 代表ファイル |
|---|---|---|
| `useNavigate` + `navigate(-1)` | 戻るボタン | PatrolPage, MainInput, EditReading |
| `useNavigate` + `navigate('/hub')` | ハブへ固定遷移 | ClawsupportHub, TanasupportHub |
| `<Link to=...>` | メニュー項目/静的リンク | AdminLayout, AdminMenu |
| `navigate('/docs/')` | ログアウト後リダイレクト | Login, AdminMenu |
| `window.history.back()` | ブラウザ戻る直接呼び出し | PatrolBoothInputPage |
| `setShowCamera(false)` | モーダル内フロー戻る | OCRTestPage, PatrolBoothInputPageBeta |
| `navigate('/clawsupport')` | 固定パス遷移 | ClawsupportStoreDash |
| `navigate('/patrol')` | 巡回トップへ | PatrolPage, PatrolScan |
| `useSearchParams` | URLパラメータ引き継ぎ | PatrolInput, DataSearch |
| `location.state` | 遷移元状態保持 | EditReading, PatrolBoothInputPage |

---

## 4. 修正推奨 (優先順)

### 高優先度 (UI-CHARTER-V2違反)

**[H1] パンくずリスト未実装 — 全66画面 (0%)**
- 違反規格: UI規約「ナビゲーション必須 / Progressive Disclosure」
- 対象: admin/pages 20画面が特に深刻 (階層3-4層で現在地不明)
- `src/admin/AdminBreadcrumb.jsx` が既存 → admin/pagesへの適用漏れ
- clawsupport/manesupportはPageHeader leftSlotに現在地テキスト追加

**[H2] タップターゲット44px未満 — 57画面 (86%)**
- 違反規格: UI規約「44px最低タップ領域 (B系ナビ)」
- ワースト: AdminMenu, AdminTop, AdminMastersHubPage等のメニュー系
- ボタン/リンク要素に `minHeight: 44, minWidth: 44` 適用

**[H3] 保存未完了離脱ダイアログ — 63画面 (95%)**
- 対象: EditReading, PatrolPage, MainInput, AdminBoothEditPage等の編集系
- 共通 `useBeforeUnload` フック実装して編集系ページに適用

### 中優先度

**[M1] 戻るボタン未実装 — admin/pages 9画面**
- 対象: AdminLoginLogsPage, AdminMasterMachinePage, AdminOperationLogsPage, AdminOrderHistoryPage, AdminPlaceholderPage, AdminPrizeMasterPage, AdminPrizePhaseHistoryPage, AdminQRLabelPage, AdminStaffListPage, AdminStockMovementsPage
- AdminLayout の左端に戻るボタン共通追加

**[M2] 空状態表示 — 28画面 (42%)**
- hub系 (AdminMenu, AdminTop, AdminMastersHubPage等) とinput系
- 共通 `EmptyState` コンポーネント整備

**[M3] エラー表示 — 19画面 (28%)**
- ClawsupportHub, ClawsupportStoreDash等のhub/一覧系
- fetch失敗時の `<ErrorBanner>` 統一適用

### 低優先度

**[L1] loading表示 — 14画面 (21%)**
- hub系はデータfetchなしのため省略は許容範囲
- fetch追加時に合わせて実装

---

*生成: T4a-UI-IA-audit / Claude Sonnet 4.6 / 2026-05-18*
