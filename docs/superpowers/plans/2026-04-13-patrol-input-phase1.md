# Phase 1 巡回入力 HTMLモック翻訳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 確定済みHTMLモックと現行Reactコンポーネントのギャップを埋め、PatrolPageを完全にモック仕様通りに動作させる

**Architecture:** 既存の PatrolPage / usePatrolForm / MonthlySummary はほぼ完成しており、3つのギャップを修正する。新規ファイルは不要。

**Tech Stack:** React 19, inline styles (PatrolPage は Tailwind 非使用), Supabase, Vitest

---

## 調査サマリー

すべてのコンポーネント・フック・サービスは既に存在する。
モックとの差異は以下の3点のみ:

| # | ファイル | 問題 | 修正 |
|---|---------|------|------|
| 1 | `PatrolPage.jsx:519` | `minHeight:'100dvh'` → スクロール不可 | `height:'100dvh', overflowY:'auto'` |
| 2 | `MonthlySummary.jsx` | 今月予測列なし、テーブル列不足、currRevenue=null | 列追加 + histRowsから計算 |
| 3 | `usePatrolForm.js:247` | resetPatrol時 `ho:'ー'` が抜ける | outs.map に `ho:'ー'` 追加 |

---

## File Structure

修正対象ファイルのみ（新規ファイルなし）:
- Modify: `src/pages/PatrolPage.jsx:519` — ルートdiv のスクロール修正
- Modify: `src/components/patrol/MonthlySummary.jsx` — サマリー列追加・計算追加
- Modify: `src/hooks/usePatrolForm.js:247` — resetPatrol の ho リセット修正

---

### Task 1: PatrolPage スクロール修正

**Files:**
- Modify: `src/pages/PatrolPage.jsx:519`

- [ ] **Step 1: 現在のコードを確認**

`src/pages/PatrolPage.jsx` 519行目:
```js
<div style={{ minHeight: '100dvh', background: '#0a0a12', color: '#e8e8f0', padding: 10, ...
```

`#root { overflow: hidden }` のため `minHeight` ではスクロールできない。

- [ ] **Step 2: `minHeight` を `height` + `overflowY` に変更**

`src/pages/PatrolPage.jsx` 519行目の `minHeight: '100dvh'` を以下に置き換える:

```js
<div style={{ height: '100dvh', overflowY: 'auto', background: '#0a0a12', color: '#e8e8f0', padding: 10, fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif", maxWidth: 640, margin: '0 auto' }}>
```

変更点: `minHeight: '100dvh'` → `height: '100dvh', overflowY: 'auto'`

- [ ] **Step 3: ビルド確認**

```bash
cd /Users/dfx/clawops && npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 4: テスト実行**

```bash
npm test
```

Expected: 163/163 tests pass

- [ ] **Step 5: コミット**

```bash
git add src/pages/PatrolPage.jsx
git commit -m "fix: PatrolPage scroll — height:100dvh + overflowY:auto"
```

---

### Task 2: MonthlySummary — 今月予測列・テーブル列追加・currRevenue計算

**Files:**
- Modify: `src/components/patrol/MonthlySummary.jsx`
- Modify: `src/pages/PatrolPage.jsx:551-554` — currRevenue計算

モックの仕様 (`patrol-pattern-a-v11.html`):
- サマリー: 今月売上 / **今月予測** / 景品代 / 出率 (4列)
- テーブル: 日付 / 売上 / **払出数** / **払出金額** / 日売平均 (5列)

histRowsで取得できるフィールド: `read_time, in_diff, out_diff_1, prize_name, play_price, revenue`
- 払出数・払出金額はDBに未格納 → `—` を表示
- 今月予測はデータ不足のため `—` を表示
- 景品代もDBに未格納 → `—` を表示
- currRevenue = `histRows.reduce((sum, r) => sum + (r.revenue ?? (r.in_diff ?? 0) * (r.play_price || 100)), 0)`
- currRate = `sum(out_diff_1) / sum(in_diff) * 100` (histRowsから計算可能)

- [ ] **Step 1: テストを書く**

`src/components/patrol/__tests__/MonthlySummary.test.jsx` を作成:

```jsx
import { render, screen } from '@testing-library/react'
import MonthlySummary from '../MonthlySummary'

const histRows = [
  { read_time: '2026-04-10', in_diff: 130, out_diff_1: 18, play_price: 100, revenue: 13000 },
  { read_time: '2026-04-12', in_diff: 150, out_diff_1: 20, play_price: 100, revenue: 15000 },
]

it('shows 4 summary columns including 今月予測', () => {
  render(<MonthlySummary currRevenue={28000} currRate={13.5} histRows={histRows} />)
  expect(screen.getByText('今月売上')).toBeInTheDocument()
  expect(screen.getByText('今月予測')).toBeInTheDocument()
  expect(screen.getByText('景品代')).toBeInTheDocument()
  expect(screen.getByText('出率')).toBeInTheDocument()
})

it('shows 5 table columns including 払出数 and 払出金額', () => {
  render(<MonthlySummary currRevenue={28000} currRate={13.5} histRows={histRows} />)
  expect(screen.getByText('払出数')).toBeInTheDocument()
  expect(screen.getByText('払出金額')).toBeInTheDocument()
})

it('shows formatted revenue in summary', () => {
  render(<MonthlySummary currRevenue={28000} currRate={13.5} histRows={histRows} />)
  expect(screen.getByText('¥28,000')).toBeInTheDocument()
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm test MonthlySummary
```

Expected: FAIL — 今月予測, 払出数, 払出金額 not found

- [ ] **Step 3: MonthlySummary.jsx を修正**

`src/components/patrol/MonthlySummary.jsx` を以下に書き換える:

```jsx
import { fmtYen } from '../../utils/format'

export default function MonthlySummary({ currRevenue, currRate, histRows }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 2, padding: '4px 4px', fontSize: 11, background: '#1a1a2e', borderRadius: 4, marginBottom: 4, marginTop: 8, borderTop: '1px solid #2a2a44', paddingTop: 8 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>今月売上</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#f0c040' }}>{fmtYen(currRevenue)}</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>今月予測</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#e8e8f0' }}>—</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>景品代</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#e8e8f0' }}>—</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#8888a8', display: 'block' }}>出率</span>
          <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", color: '#5dade2' }}>{currRate != null ? currRate.toFixed(1) + '%' : '—'}</span>
        </div>
      </div>

      {histRows && histRows.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: "'Courier New', monospace" }}>
            <thead>
              <tr>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'left', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>日付</th>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>売上</th>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>払出数</th>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>払出金額</th>
                <th style={{ fontSize: 9, color: '#8888a8', fontWeight: 400, textAlign: 'right', padding: '3px 4px', borderBottom: '1px solid #2a2a44' }}>日売平均</th>
              </tr>
            </thead>
            <tbody>
              {histRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '3px 4px', color: '#8888a8', borderBottom: '1px solid rgba(42,42,68,.4)' }}>
                    {r.read_time ? String(r.read_time).slice(5, 10).replace('-', '/') : '—'}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#d0d0e0', borderBottom: '1px solid rgba(42,42,68,.4)' }}>
                    {r.in_diff != null ? fmtYen(r.revenue ?? r.in_diff * (r.play_price || 100)) : '—'}
                  </td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#d0d0e0', borderBottom: '1px solid rgba(42,42,68,.4)' }}>—</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#d0d0e0', borderBottom: '1px solid rgba(42,42,68,.4)' }}>—</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right', color: '#d0d0e0', borderBottom: '1px solid rgba(42,42,68,.4)' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: PatrolPage.jsx の currRevenue・currRate 計算を追加**

`src/pages/PatrolPage.jsx` 549行目付近 (MonthlySummary の直前) に計算を追加する。
現在のコード (551-554行目):

```jsx
      {/* 月次サマリー */}
      <MonthlySummary
        currRevenue={null}
        currRate={null}
        histRows={hist} />
```

以下に置き換える:

```jsx
      {/* 月次サマリー */}
      {(() => {
        const totalIn = hist?.reduce((s, r) => s + (r.in_diff ?? 0), 0) ?? 0
        const totalOut = hist?.reduce((s, r) => s + (r.out_diff_1 ?? 0), 0) ?? 0
        const currRevenue = hist && hist.length > 0
          ? hist.reduce((s, r) => s + (r.revenue ?? (r.in_diff ?? 0) * (r.play_price || 100)), 0)
          : null
        const currRate = totalIn > 0 ? (totalOut / totalIn * 100) : null
        return (
          <MonthlySummary
            currRevenue={currRevenue}
            currRate={currRate}
            histRows={hist} />
        )
      })()}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npm test MonthlySummary
```

Expected: PASS

- [ ] **Step 6: ビルド確認**

```bash
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/patrol/MonthlySummary.jsx src/components/patrol/__tests__/MonthlySummary.test.jsx src/pages/PatrolPage.jsx
git commit -m "feat: MonthlySummary add 今月予測/払出数/払出金額 columns, calculate currRevenue from histRows"
```

---

### Task 3: usePatrolForm — resetPatrol の ho リセットバグ修正

**Files:**
- Modify: `src/hooks/usePatrolForm.js:247-253`

**問題:** `resetPatrol()` で `outs.map(...)` の際、`ho: 'ー'` が指定されていない。
`makeOut(n)` で初期値 `ho: 'ー'` を設定しているが、`resetPatrol` でその値が上書き不足。

現在のコード (247-253行目):
```js
      initP.outs = initP.outs.map((o, i) => ({
        ...o,
        meter: prevOuts[i]?.meter != null ? String(prevOuts[i].meter) : '',
        zan: prevStocks[i] != null ? String((prevStocks[i]||0) + (prevRestocks[i]||0)) : '',
        prize: prevOuts[i]?.prize || '',
        cost: prevOuts[i]?.cost != null ? String(prevOuts[i].cost) : '',
      }))
```

`...o` はスプレッドで `makeOut()` の `ho: 'ー'` を引き継ぐはずだが、`makeInitialSection()` がどう実装されているか、`o.ho` が正しく `'ー'` であることを明示するため、明示的に追加する。

- [ ] **Step 1: makeOut の実装を確認**

`src/hooks/usePatrolForm.js` の冒頭付近を読み、`makeOut` の定義を確認:

```bash
grep -n "makeOut\|ho:" /Users/dfx/clawops/src/hooks/usePatrolForm.js | head -20
```

Expected出力: `makeOut` が `ho: 'ー'` を含むことを確認

- [ ] **Step 2: resetPatrol に `ho: 'ー'` を明示追加**

`src/hooks/usePatrolForm.js` の `initP.outs = initP.outs.map(...)` を以下に変更:

```js
      initP.outs = initP.outs.map((o, i) => ({
        ...o,
        meter: prevOuts[i]?.meter != null ? String(prevOuts[i].meter) : '',
        zan: prevStocks[i] != null ? String((prevStocks[i]||0) + (prevRestocks[i]||0)) : '',
        ho: 'ー',
        prize: prevOuts[i]?.prize || '',
        cost: prevOuts[i]?.cost != null ? String(prevOuts[i].cost) : '',
      }))
```

- [ ] **Step 3: テスト実行**

```bash
npm test
```

Expected: 163/163 tests pass (既存テストが壊れないことを確認)

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePatrolForm.js
git commit -m "fix: resetPatrol explicitly sets ho:'ー' for each out"
```

---

### Task 4: 最終確認

- [ ] **Step 1: 全テスト実行**

```bash
cd /Users/dfx/clawops && npm test
```

Expected: 全テスト pass

- [ ] **Step 2: プロダクションビルド確認**

```bash
npm run build
```

Expected: dist/ 生成、エラーなし

- [ ] **Step 3: 通知**

```bash
~/scripts/zundamon.sh "Phase1巡回入力の修正が完了しました"
curl -d "Phase1巡回入力の修正が完了しました" ntfy.sh/clawops-hiro-0328
```

---

## 自己レビュー

**スペックカバレッジ:**
- ✅ PatrolPage スクロール修正
- ✅ MonthlySummary 今月予測列追加
- ✅ MonthlySummary 払出数/払出金額列追加
- ✅ currRevenue を histRows から計算
- ✅ resetPatrol ho バグ修正
- ℹ️ 払出数/払出金額の実データはDB未格納のため `—` 表示 (今後の課題)
- ℹ️ 今月予測の計算はデータ不足のため `—` 表示 (今後の課題)

**プレースホルダーなし:** 全ステップにコードあり ✅

**型/関数名の一貫性:** fmtYen は既存 import 済み、hist/histRows props 名は既存と一致 ✅
