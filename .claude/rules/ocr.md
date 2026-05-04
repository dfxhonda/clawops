# OCRパイプライン (2026-05現在)

## 正規構成 (復旧予定 = ADR-003)
MeterOcr.jsx → supabase.functions.invoke('ocr-meter') → dfx_api_key Secret (Supabase) → Anthropic API
- APIキーはサーバーサイドのみ、クライアント側に露出しない (セキュア)
- supabase/functions/ocr-meter/ は今も ACTIVE で稼働中
- 復旧手順: USE_NEW_CAMERA フラグ削除でこの経路に戻る

## 5/1事故構成 (Deprecated = ADR-001)
NativeCamera.jsx → VITE_ANTHROPIC_API_KEY → Anthropic API (client-side)
- VITE_ プレフィックスでブラウザに APIキー露出する設計、漏洩リスクあり
- 5/1 Claude Code が ocr-meter 存在を grep せず独自実装、3日間OCR動作不能の原因
- 5/4 ヒロさん指摘で却下、Edge Function経路に戻す予定

## 鉄則
- 新規API経路実装前に supabase/functions/ を必ず grep
- VITE_ プレフィックスで API キー保管禁止 (業界デフォ)
- 既存 Edge Function があれば必ずそれを使う、クライアント直叩きの新規実装禁止
