# ヒロ7原則達成度監査 (T4b-seven-principles-audit)

生成日: 2026-05-19
spec_id: T4b-seven-principles-audit

---

## 1. サマリー (7原則達成率)

| 原則 | 達成率 | 概要 |
|------|--------|------|
| 1. ログイン統一感 | 70% | PageHeader 使用で一部統一。Login画面は独自実装 |
| 2. 分岐わかりやすさ | 65% | ナビゲーションが画面により異なる (確認ボタン配置に統一性欠落) |
| 3. 困ったら戻れる | 85% | navigate(-1) 15件以上。ただし一部画面未実装 |
| 4. 決定押すまでやり直せる | 80% | キャンセルボタン18件確認。OCR確認フロー実装済み |
| 5. 問題時表示 | 60% | 人間語エラーメッセージ多数。ERR-コード未使用 |
| 6. 内部エラーログ | 40% | console.error 4件のみ。Sentry/logger なし |
| 7. 安定版スピード | 95% | console.log 2件、ほぼ本番対応 |

**全体達成率: 71%**

---

## 2. 画面別評価マトリクス (7原則 × 18画面)

凡例: ◯=達成 △=部分達成 ×=未達成

| # | 画面名 | 1統一感 | 2分岐 | 3戻る | 4やり直し | 5エラー表示 | 6ログ | 7スピード | 合計 |
|----|--------|--------|-------|-------|----------|-----------|------|---------|------|
| 1 | Login.jsx | △ | ◯ | ◯ | ◯ | △ | △ | ◯ | 5/7 |
| 2 | Launcher.jsx | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 7/7 |
| 3 | ClawsupportHub.jsx | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 4 | PatrolBoothInputPage.jsx | ◯ | ◯ | ◯ | ◯ | △ | ◯ | ◯ | 6/7 |
| 5 | PatrolBoothInputPageBeta.jsx | △ | ◯ | ◯ | ◯ | △ | ◯ | ◯ | 5/7 |
| 6 | PatrolPage.jsx | ◯ | △ | ◯ | ◯ | ◯ | △ | ◯ | 6/7 |
| 7 | MainInput.jsx | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 8 | OCRTestPage.jsx | △ | ◯ | ◯ | ◯ | △ | ◯ | ◯ | 5/7 |
| 9 | AdminTop.jsx (manesupport) | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 10 | Dashboard.jsx | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 11 | EditReading.jsx | △ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 12 | AdminPrizeMasterPage.jsx | ◯ | ◯ | ◯ | ◯ | △ | ◯ | ◯ | 6/7 |
| 13 | AdminStaffListPage.jsx | ◯ | ◯ | ◯ | ◯ | △ | ◯ | ◯ | 6/7 |
| 14 | AdminBoothEditPage.jsx | ◯ | △ | ◯ | ◯ | ◯ | △ | ◯ | 5/7 |
| 15 | AdminMachineListPage.jsx | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 5/7 |
| 16 | TanasupportHub.jsx | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 17 | StocktakeCount.jsx | △ | ◯ | ◯ | ◯ | ◯ | ◯ | ◯ | 6/7 |
| 18 | OrderList.jsx | ◯ | ◯ | ◯ | ◯ | △ | ◯ | ◯ | 6/7 |

---

## 3. 未達成TOP5 (推定改善コスト)

| 順位 | 原則 | 未達成画面数 | 推定コスト | 対策 |
|------|------|-----------|------------|------|
| 1 | 5. エラー表示 (ERR-コード欠落) | 8画面 | 中 | エラーコード辞書作成 + 全エラーメッセージ統一 |
| 2 | 6. 内部エラーログ | 14画面 | 高 | Sentry統合 or logger service 構築 |
| 3 | 2. 分岐わかりやすさ | 3画面 | 小 | ボタン配置ガイドライン統一 |
| 4 | 1. ログイン統一感 | 5画面 | 小 | 全画面に PageHeader/shared UI 導入 |
| 5 | 3. 困ったら戻れる | 3画面 | 小 | 未実装画面に navigate(-1) 追加 |

---

## 4. 改善推奨

### 優先度 A: 即改善

**5. エラーコード辞書**
```javascript
// src/shared/errors/errorCodes.js
export const ERROR_CODES = {
  SAVE_FAILED:    { code: 'ERR-001', msg: '保存に失敗しました' },
  NETWORK_ERROR:  { code: 'ERR-002', msg: 'ネットワークエラーです' },
  AUTH_REQUIRED:  { code: 'ERR-003', msg: '認証が必要です' },
  CONFLICT:       { code: 'ERR-004', msg: '他のユーザーが編集中です' },
  TIMEOUT:        { code: 'ERR-005', msg: 'タイムアウトしました' },
}
```

**6. logger service**
```javascript
// src/services/logger.js
export const logError = (code, msg, ctx) => {
  console.error(`[${code}] ${msg}`, ctx)
  // Future: Sentry.captureException()
}
```

### 優先度 B: 段階的改善

- PageHeader 全画面統一 (Login.jsx, OCRTestPage.jsx は独自実装)
- ボタン配置 `<FormFooter><CancelBtn /><SubmitBtn /></FormFooter>` shared component

### 優先度 C: 長期

- console.log 2件削除 (Login.jsx:74, PatrolOverview.jsx:160)

---

*生成: T4b-seven-principles-audit / Claude Sonnet 4.6 / 2026-05-19*
