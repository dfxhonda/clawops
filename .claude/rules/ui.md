# UI規約

## デザイン憲章 (新人初日+熟練者爆速の両立)
- A系 (入力密度系): text-xs, NumpadField, grid-cols-2圧縮、熟練者爆速優先
- B系 (ナビ階層系): text-base, Progressive Disclosure, 44px最低タップ領域

## iOS Safari 対応
- input[type=file] の display:none は input 要素自身に直接付ける、親div不可 (iOS Safari change未発火事故 2026-05-04)
- Apple標準キーボード禁止、NumpadField bottom sheet 使用
- カスタムNumpad: autoFocus + onFocus全選択 (or 「最初キー上書き」代替)

## ナビゲーション必須
- すべての画面に戻る動線、PageHeader leftSlot に「← 戻る」、rightSlot に LogoutButton
- ハードウェア戻るボタンも階層的に動作

## 戻る動線・ロゴアウト動線 (PWA起動時アドレスバー無し対策)
- /clawsupport, /tanasupport, /admin 全ハブにLogoutButton
- 階層2階以降は leftSlot ←戻るボタン
