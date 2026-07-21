// SPEC-TESTBADGE-WATERMARK-ALLPAGES-01 (D-114): テスト版(preview/development)でのみ全ページに「テスト版」透かしを表示。
// 本番(__VERCEL_ENV__==='production')では null を返し自動で消える。fixed inset-0 の最上位オーバーレイ1枚で
// ページ構造(フルスクリーンテンキー等バラバラなレイアウト)に依存せず全ページ同一の見え方を物理保証する。
// pointer-events:none + user-select:none + aria-hidden=true で操作(タップ/スクロール/テンキー)を一切阻害しない。
// 環境判定は vite.config の既存 define `__VERCEL_ENV__` を使う(新規env変数なし)。env prop はテスト差し替え用の口。

// 既存 sentry.js L25 と同じガード形。undefined 時は安全側=production 扱い(=非表示)。
function resolveEnv() {
  return typeof __VERCEL_ENV__ !== 'undefined' ? __VERCEL_ENV__ : 'production'
}

export default function TestBuildWatermark({ env } = {}) {
  const e = env ?? resolveEnv()
  if (e === 'production') return null

  return (
    <div
      data-testid="test-build-watermark"
      aria-hidden="true"
      className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden"
    >
      {/* 中央斜めの薄い大文字 (opacity低め・大きめ・rotate) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-black whitespace-nowrap text-pink-500"
          style={{ opacity: 0.08, transform: 'rotate(-38deg)', fontSize: '22vw', lineHeight: 1 }}
        >
          テスト版
        </span>
      </div>
      {/* 右下の常時視認ラベル (やや濃いめ) */}
      <div className="absolute bottom-2 right-2">
        <span className="text-xs font-bold text-pink-400/80 bg-pink-950/40 rounded px-1.5 py-0.5">テスト版</span>
      </div>
    </div>
  )
}
