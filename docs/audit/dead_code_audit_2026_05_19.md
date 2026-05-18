# デッドコード監査レポート (T4d-dead-code-audit)

生成日: 2026-05-19
spec_id: T4d-dead-code-audit

---

## サマリー

| 項目 | 件数 |
|------|------|
| 未使用ファイル候補 | 3件 |
| console.log 残存 | 22件 |
| TODO/FIXME コメント | 0件 |
| disabled フェーズ | 1件 (Phase 4: OCR) |

---

## 1. 未使用ファイル候補 (削除推奨順)

### 高 — 削除推奨

**1. PatrolOverview.jsx**
- パス: `src/clawsupport/pages/PatrolOverview.jsx` (330行)
- App.jsx でルート登録なし。Phase 4 一時無効化の遺物。
- Safety Score: 高 (削除可)

**2. AdminMenu.jsx**
- パス: `src/manesupport/pages/AdminMenu.jsx` (90+行)
- App.jsx でルート登録なし。PatrolOverview の `/admin/menu` リンクから参照のみ (導線自体も無効)
- Safety Score: 高 (削除可)

**3. AdminTop.jsx (manesupport版)**
- パス: `src/manesupport/pages/AdminTop.jsx` (64+行)
- App.jsx で未登録。`src/admin/_legacy/AdminTop.jsx` と別実装で混在
- Safety Score: 高 (削除可)

---

## 2. console.log 残存一覧 (22件)

| ファイル | 件数 | 内容 | 優先度 |
|---------|------|------|--------|
| imageResize.js | 8件 | 画像圧縮フェーズログ | 低 |
| ocrApi.js | 8件 | OCR API呼び出しログ | 低 |
| GachaInputV3.jsx | 2件 | ガチャ景品選択ログ | 中 |
| MeterOcr.jsx | 1件 | OCR信頼度ログ | 低 |
| OcrConfirm.jsx | 1件 | レンダリング開始ログ | 低 |
| PatrolOverview.jsx | 1件 | FullshotCamera保存ログ | 中 |
| Login.jsx | 1件 | スタッフロード数ログ | 低 |

---

## 3. TODO/FIXME コメント

検出なし (0件)。ただし無効化フェーズ注釈あり:
- `App.jsx:291-292` — Phase 4 一時無効化中 (OcrConfirmのReferenceError調査中)
- `PatrolOverview.jsx:149-156` — Phase 4 一時無効化 (2026-04-18)

---

## 4. _legacy フォルダ

`src/admin/_legacy/` に 3ファイル (AdminSidebar.jsx, AdminTop.jsx, RevenueDashboard.jsx)
App.jsx から import なし、隔離済み。

---

## 5. 削除推奨リスト

| 優先度 | ファイル | 理由 |
|--------|---------|------|
| 1 | PatrolOverview.jsx | Phase 4 復活時に再実装推奨 |
| 2 | AdminMenu.jsx | Launcher で代替済み |
| 3 | AdminTop.jsx (manesupport) | _legacy 版に統一 |

---

## 6. フェーズ状態

```
✅ Phase 1-3: 運用中 (PatrolBoothInputPage, PatrolStorePage 等)
⏸️ Phase 4: 一時無効化 (OCR機能 - OcrConfirmのReferenceError調査中)
   └─ 関連: PatrolCameraPage, PatrolBatchOcrPage, OCRTestPage (routes定義あり)
   └─ 隠し導線: PatrolOverview + AdminMenu (route未定義)
```

---

*生成: T4d-dead-code-audit / Claude Sonnet 4.6 / 2026-05-19*
