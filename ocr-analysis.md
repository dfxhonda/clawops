# OCR動線解析レポート 2026-05-04

## 症状
- 📷 ボタン → カメラ起動 → 撮影 → ブース画面に戻るが何も起きない
- 🖼️ ボタン → ダイアログ → 写真選択 → 何も起きない
- 両ボタンとも「ファイルピッカーは開く」「選択後のonChangeが発火しない」

---

## 根本原因

**`display: none` を input 自身ではなく親 div に掛けたことで、iOS Safari が `change` イベントを発火しない。**

### コード差分

**旧 (e88f815 — 動作していた構造):**
```jsx
<div>                                    ← 親: visible
  <input style={{ display: 'none' }}    ← input 自身に display:none
         onChange={handleCapture} />
  <button>📸 撮影</button>              ← ボタンも同じ div に
</div>
```

**新 (79f5af8 — 壊れた構造):**
```jsx
<div style={{ display: 'none' }}>       ← 親に display:none ← ★ ここが問題
  <input ref={cameraInputRef}           ← input 自身は display 指定なし
         onChange={handleCapture} />
  <input ref={galleryInputRef}
         onChange={handleCapture} />
</div>
```

### iOS Safari の仕様

| パターン | ファイルピッカー開く | onChange 発火 |
|----------|---------------------|---------------|
| `input[style="display:none"]` | ✅ `.click()` で開く | ✅ 発火する |
| `div[style="display:none"] > input` | ✅ `.click()` で開く | ❌ **発火しない** |

iOS Safari は「非表示サブツリー内の要素」には change イベントを送出しない。  
親 div が `display:none` になった瞬間にサブツリー全体がイベント対象外になる。

---

## 追跡経路

```
ボタン押下
  → onCamera() / onGallery()               [PatrolPage.jsx:68-73]
  → nativeCamRef.current?.triggerCamera()   [NativeCamera.jsx:35]
  → cameraInputRef.current?.click()
  → iOS ファイルピッカー表示 ← ここまでは正常
  ↓
撮影/選択後
  → change イベント発生 ← iOS が消す（display:none 親のため）
  → handleCapture(e) 未呼び出し
  → onOcrResult() 未呼び出し
  → handleNativeCameraResult() 未呼び出し [PatrolPage.jsx:224]
  → IN フィールドにセットされない
```

---

## 修正案

### 最小修正 (1行変更)

`NativeCamera.jsx` の `<div style={{ display: 'none' }}>` を外して、  
各 input に直接 `style={{ display: 'none' }}` を付ける。

```jsx
// Before (壊れている)
return (
  <div style={{ display: 'none' }}>
    <input ref={cameraInputRef} ... onChange={handleCapture} />
    <input ref={galleryInputRef} ... onChange={handleCapture} />
  </div>
)

// After (修正済み)
return (
  <>
    <input ref={cameraInputRef} style={{ display: 'none' }} ... onChange={handleCapture} />
    <input ref={galleryInputRef} style={{ display: 'none' }} ... onChange={handleCapture} />
  </>
)
```

### 変更ファイル
- `src/clawsupport/components/NativeCamera.jsx` のみ、4行変更
- PatrolPage / MeterInputRow / GachaInputV3 は変更不要

---

## OCR処理パイプライン (正常経路)

```
NativeCamera.handleCapture(e)
  → createImageBitmap(file)
  → otsu 二値化 (上1/3クロップ)
  → Supabase Storage upload (警告のみ、失敗してもOCR続行)
  → Claude Haiku Vision API (VITE_ANTHROPIC_API_KEY 必須)
  → extractedNumber = parseInt(text)
  → onOcrResult({ extractedNumber, photoUrl, croppedPhotoUrl })
      ↓
PatrolPage.handleNativeCameraResult()
  → setPatrolIn(String(extractedNumber))  ← IN フィールドに反映
  → setPhotoUrl / setCroppedPhotoUrl
```

パイプライン自体は正常。onChange さえ発火すれば動く。

---

## 副次確認事項

- `VITE_ANTHROPIC_API_KEY` 未設定の場合: OCR スキップ → `extractedNumber = null` のまま `onOcrResult` 呼ばれる → IN に何もセットされない。これは別問題。
- `storagePrefix` に `booth?.store_code` を参照しているが booth オブジェクトは `booth_code` のみ持つ可能性あり → storage パスが `unknown/` になるが処理は続行する。問題なし。

---

## 結論

**修正は NativeCamera.jsx の `<div>` ラッパーを外して各 input に `display:none` を直接付けるだけ。所要時間 5分。**
